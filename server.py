from contextlib import closing
"""Local library web server. Run: python server.py"""
import argparse
import hashlib
import hmac
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def initialize_database(database):
    database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS accounts (student_id TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, student_id TEXT NOT NULL, expires REAL NOT NULL)")


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600_000).hex()


def credential_error(name, student_id, password, role):
    if not 1 <= len(name) <= 80 or not all(part and part.isalpha() for part in re.split(r"[ ·'’\-]", name)):
        return '姓名请填写文字，可含空格、间隔号、短横线或撇号，不能包含数字。'
    if not re.fullmatch(r'[0-9]{1,32}', student_id):
        return '学号只能填写 1–32 位数字，不能包含字母、空格或其他符号。'
    if not 6 <= len(password) <= 128:
        return '密码至少 6 位，最多 128 位。'
    if role not in ('reader', 'admin'):
        return '请选择读者或管理员身份。'
    return None


class LibraryHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def reply(self, status, payload, cookie=None):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(data)

    def token_hash(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
            token = jar['library_session'].value if 'library_session' in jar else ''
        except cookies.CookieError:
            token = ''
        return hashlib.sha256(token.encode()).hexdigest()

    def account(self, db):
        return db.execute("SELECT a.student_id, a.name, a.is_admin FROM sessions s JOIN accounts a ON a.student_id = s.student_id WHERE s.token_hash = ? AND s.expires > ?", (self.token_hash(), time.time())).fetchone()

    @staticmethod
    def public_account(account):
        return {'studentId': account[0], 'name': account[1], 'isAdmin': bool(account[2])}

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == '/api/auth-status':
            with closing(sqlite3.connect(self.server.database)) as db, db:
                exists = db.execute('SELECT 1 FROM accounts WHERE is_admin = 1').fetchone()
            return self.reply(200, {'adminSetupAvailable': not bool(exists)})
        if route == '/api/session':
            with closing(sqlite3.connect(self.server.database)) as db, db:
                account = self.account(db)
            return self.reply(200 if account else 401, {'user': self.public_account(account)} if account else {'error': '请先登录。'})
        if route.startswith('/api/'):
            return self.reply(404, {'error': '接口不存在。'})
        return super().do_GET()

    def do_POST(self):
        # Only our own local page may submit authentication requests.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            return self.reply(403, {'error': '请求来源不匹配。'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError
            values = json.loads(self.rfile.read(length))
            if not isinstance(values, dict):
                raise ValueError
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {'error': '请求格式不正确。'})
        route = urlsplit(self.path).path
        with closing(sqlite3.connect(self.server.database, timeout=10)) as db, db:
            if route == '/api/logout':
                db.execute('DELETE FROM sessions WHERE token_hash = ?', (self.token_hash(),))
                return self.reply(200, {'ok': True}, 'library_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if route not in ('/api/login', '/api/register'):
                return self.reply(404, {'error': '接口不存在。'})
            name, student_id, password, role = (values.get(key, '') for key in ('name', 'studentId', 'password', 'role'))
            if not all(isinstance(value, str) for value in (name, student_id, password, role)):
                return self.reply(400, {'error': '请填写有效的登录信息。'})
            name, student_id = name.strip(), student_id.strip()
            error = credential_error(name, student_id, password, role)
            if error:
                return self.reply(400, {'error': error})
            if route == '/api/register':
                db.execute('BEGIN IMMEDIATE')
                if role == 'admin' and db.execute('SELECT 1 FROM accounts WHERE is_admin = 1').fetchone():
                    return self.reply(403, {'error': '管理员已设置，请使用已有管理员账号登录。'})
                salt = secrets.token_hex(16)
                try:
                    db.execute('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)', (student_id, name, salt, password_hash(password, salt), int(role == 'admin')))
                except sqlite3.IntegrityError:
                    return self.reply(409, {'error': '该学号已注册，请登录或更换学号。'})
            else:
                row = db.execute('SELECT name, salt, password_hash, is_admin FROM accounts WHERE student_id = ?', (student_id,)).fetchone()
                salt = row[1] if row else '00' * 16
                digest = password_hash(password, salt)
                if not row or not hmac.compare_digest(digest, row[2]) or row[0] != name or bool(row[3]) != (role == 'admin'):
                    return self.reply(401, {'error': '姓名、学号、密码或登录身份不匹配，请检查后重试。'})
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), student_id, time.time() + 8 * 3600))
            account = (student_id, name, role == 'admin')
            db.commit()
            return self.reply(200, {'user': self.public_account(account)}, f'library_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')


def make_server(port=8001, database=None):
    database = Path(database) if database else ROOT / 'local-data/accounts.sqlite3'
    initialize_database(database)
    server = ThreadingHTTPServer(('127.0.0.1', port), LibraryHandler)
    server.database = database
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the library website with local account login.')
    parser.add_argument('--port', type=int, default=8001)
    parser.add_argument('--open', action='store_true', help='Open the website in the default browser.')
    args = parser.parse_args()
    with make_server(args.port) as server:
        url = f'http://localhost:{server.server_port}'
        print(f'Library is running: {url}', flush=True)
        print('Keep this window open. Press Ctrl+C to stop.', flush=True)
        if args.open:
            import webbrowser
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
