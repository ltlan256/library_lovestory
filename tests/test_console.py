"""Exercise the built console program without changing the project's user data."""
from pathlib import Path
import shutil
import re
import subprocess
import sys
import tempfile


def main():
    executable = Path(sys.argv[1]).resolve()
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix='library-smoke-') as folder:
        working = Path(folder)
        for name in ('books.txt', 'users.txt', 'loans.txt'):
            shutil.copy2(root / name, working / name)
        shutil.copytree(root / 'assets', working / 'assets')
        before = {name: (working / name).read_bytes()
                  for name in ('books.txt', 'users.txt', 'loans.txt')}
        # View instructions, return to the menu, and exit normally.
        result = subprocess.run([str(executable)], input='2\n\n0\n',
                                cwd=working, capture_output=True, encoding='utf-8',
                                errors='replace', timeout=15)
        assert result.returncode == 0, result.stderr
        assert '已加载' in result.stdout and '系统已退出' in result.stdout, result.stdout
        loaded = re.search(r'已加载 (\d+) 本图书', result.stdout)
        assert loaded and int(loaded.group(1)) > 0, 'The catalog was not loaded'
        for name, content in before.items():
            assert (working / name).read_bytes() == content, f'{name} changed'
    print('PASS: console starts, loads data, shows instructions, exits and preserves data')


if __name__ == '__main__':
    main()
