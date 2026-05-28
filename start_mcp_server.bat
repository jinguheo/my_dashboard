@echo off
setlocal

cd /d "D:\MyWork\my-dashboard"

netstat -ano | findstr /R /C:":8765 .*LISTENING" >nul
if %ERRORLEVEL%==0 exit /b 0

"C:\Users\oem\miniconda3\python.exe" stock_mcp_server.py >> mcp-server.log 2>&1
