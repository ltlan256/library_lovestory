@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>&1
if not errorlevel 1 (
    py -3 server.py --open %*
    goto finished
)
python -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>&1
if not errorlevel 1 (
    python server.py --open %*
    goto finished
)
echo Python 3.8+ is required. Install Python from https://www.python.org/downloads/
echo Then reopen this launcher.
pause
exit /b 1
:finished
if errorlevel 1 (
    echo Server stopped with an error. Read the message above.
    pause
    exit /b 1
)
endlocal
