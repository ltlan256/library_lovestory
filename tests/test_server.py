from contextlib import closing
import http.cookiejar
import json
from pathlib import Path
import secrets
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

from server import make_server


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / 'accounts.sqlite3'
        self.server = make_server(0, self.database)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
        self.jar = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.password = secrets.token_urlsafe(12)
        self.reader = dict(name='测试读者', studentId='20261021', password=self.password, role='reader')

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, route, values=None, origin=None):
        data = json.dumps(values).encode() if values is not None else None
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        request = urllib.request.Request(self.base + route, data=data, headers=headers)
        try:
            response = self.client.open(request)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def test_reader_lifecycle_and_credentials(self):
        self.assertEqual(self.request('/api/session')[0], 401)
        status, result = self.request('/api/register', self.reader)
        self.assertEqual(status, 200)
        self.assertEqual(result['user']['name'], self.reader['name'])
        self.assertFalse(result['user']['isAdmin'])
        self.assertNotIn('password', result['user'])
        self.assertEqual(self.request('/api/session')[0], 200)
        self.assertTrue(any(cookie.has_nonstandard_attr('HttpOnly') for cookie in self.jar))
        self.assertEqual(self.request('/api/logout', {})[0], 200)
        self.assertEqual(self.request('/api/session')[0], 401)
        for field, wrong in [('name', '其他姓名'), ('password', 'incorrect-value'), ('role', 'admin'), ('studentId', '000')]:
            with self.subTest(field=field):
                self.assertEqual(self.request('/api/login', {**self.reader, field: wrong})[0], 401)
        self.assertEqual(self.request('/api/login', self.reader)[0], 200)
        self.assertEqual(self.request('/api/register', self.reader)[0], 409)
        with closing(sqlite3.connect(self.database)) as db, db:
            stored = db.execute('SELECT password_hash FROM accounts').fetchone()[0]
            self.assertNotEqual(stored, self.password)
            db.execute('UPDATE sessions SET expires = 0')
        self.assertEqual(self.request('/api/session')[0], 401)

    def test_admin_setup_and_role_verification(self):
        self.assertTrue(self.request('/api/auth-status')[1]['adminSetupAvailable'])
        admin = {**self.reader, 'name': '测试管理员', 'studentId': '100001', 'role': 'admin'}
        self.assertEqual(self.request('/api/register', admin)[0], 200)
        self.assertFalse(self.request('/api/auth-status')[1]['adminSetupAvailable'])
        self.assertEqual(self.request('/api/register', {**admin, 'studentId': '100002'})[0], 403)
        self.request('/api/logout', {})
        self.assertEqual(self.request('/api/login', admin)[0], 200)
        self.assertTrue(self.request('/api/session')[1]['user']['isAdmin'])
        self.assertEqual(self.request('/api/login', {**admin, 'role': 'reader'})[0], 401)

    def test_validation_and_cross_origin(self):
        for field in ['name', 'studentId', 'password', 'role']:
            with self.subTest(field=field):
                self.assertEqual(self.request('/api/register', {**self.reader, field: ''})[0], 400)
        self.assertEqual(self.request('/api/register', {**self.reader, 'studentId': '../invalid'})[0], 400)
        self.assertEqual(self.request('/api/register', self.reader, origin='http://example.com')[0], 403)
        self.assertEqual(self.request('/api/missing', {})[0], 404)

    def test_name_numeric_id_and_password_rules(self):
        for role in ('reader', 'admin'):
            for endpoint in ('/api/login', '/api/register'):
                for field, invalid in [('name', '张三123'), ('name', '123456'), ('name', '张🙂'), ('studentId', 'admin001'), ('studentId', '12 34'), ('studentId', '123-456'), ('studentId', '１２３'), ('password', '12345')]:
                    with self.subTest(role=role, endpoint=endpoint, field=field, invalid=invalid):
                        status, result = self.request(endpoint, {**self.reader, 'role': role, field: invalid})
                        self.assertEqual(status, 400)
                        self.assertIn('error', result)
        valid = {**self.reader, 'name': '张三', 'studentId': '000123', 'password': secrets.token_hex(3)}
        status, result = self.request('/api/register', valid)
        self.assertEqual(status, 200, 'six-character passwords are valid')
        self.assertEqual(result['user']['studentId'], '000123', 'leading zeros are preserved')
        self.request('/api/logout', {})
        self.assertEqual(self.request('/api/login', valid)[0], 200)


if __name__ == '__main__':
    unittest.main()
