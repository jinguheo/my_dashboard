@echo off
setlocal
cd /d "D:\MyWork\my-dashboard"

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo MCP already running
) else (
    start "MCP Server" /min "C:\Users\oem\miniconda3\python.exe" stock_mcp_server.py
    echo MCP server started
)

netstat -ano | findstr ":8766" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Avatar API already running
) else (
    start "Avatar API" /min "C:\Users\oem\miniconda3\envs\avatar\python.exe" "D:\MyWork\mental-avatar\api\server.py"
    echo Avatar API started
)

tasklist /FI "WINDOWTITLE eq Avatar Watcher" 2>nul | findstr "python" >nul
if %ERRORLEVEL%==0 (
    echo Avatar Watcher already running
) else (
    start "Avatar Watcher" /min "C:\Users\oem\miniconda3\envs\avatar\python.exe" "D:\MyWork\mental-avatar\watcher\file_watcher.py"
    echo Avatar Watcher started
)

netstat -ano | findstr ":9222" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Chrome already running with CDP
) else (
    tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | findstr "chrome.exe" >nul
    if %ERRORLEVEL%==0 (
        echo Chrome is running but without CDP - bridge may not work
    ) else (
        start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --load-extension="D:\MyWork\my-dashboard\chrome-extension" --no-first-run --no-default-browser-check https://claude.ai
        echo Chrome started with CDP + extension
    )
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Vite already running
) else (
    start "Vite Server" /min "C:\Program Files\nodejs\npm.cmd" run dev
    echo Vite server started
)
