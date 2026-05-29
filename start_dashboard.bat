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

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Vite already running
) else (
    start "Vite Server" /min "C:\Program Files\nodejs\npm.cmd" run dev
    echo Vite server started
)
