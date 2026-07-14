@echo off
setlocal

cd /d "%~dp0"

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if %ERRORLEVEL%==0 exit /b 0

npm.cmd run dev >> vite-server.log 2>&1
