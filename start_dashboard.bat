@echo off
setlocal

cd /d "D:\MyWork\my-dashboard"

:: MCP 서버 (포트 8765)
netstat -ano | findstr /R /C:":8765 .*LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo MCP server already running
) else (
    start /b "" "C:\Users\oem\miniconda3\python.exe" stock_mcp_server.py >> mcp-server.log 2>&1
    echo MCP server started
)

:: Vite 개발 서버 (포트 5173)
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Vite server already running
) else (
    start /b "" "C:\Program Files\nodejs\npm.cmd" run dev >> vite-server.log 2>&1
    echo Vite server started
)
