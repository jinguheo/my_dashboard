@echo off
setlocal

cd /d "D:\MyWork\my-dashboard"

netstat -ano | findstr /R /C:":8765 .*LISTENING" >nul
if %ERRORLEVEL%==0 exit /b 0

set "PYTHON_EXE=python"
if exist ".venv\Scripts\python.exe" set "PYTHON_EXE=.venv\Scripts\python.exe"

"%PYTHON_EXE%" stock_mcp_server.py >> mcp-server.log 2>&1
