@echo off
setlocal

cd /d "D:\MyWork\my-dashboard"

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if %ERRORLEVEL%==0 exit /b 0

"C:\Program Files\nodejs\npm.cmd" run dev >> vite-server.log 2>&1
