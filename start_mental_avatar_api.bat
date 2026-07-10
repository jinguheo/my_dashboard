@echo off
setlocal

set "AVATAR_ROOT=D:\MyWork\mental-avatar"
set "AVATAR_API=%AVATAR_ROOT%\api\server.py"
set "AVATAR_PYTHON=C:\Users\oem\miniconda3\envs\avatar\python.exe"

if not exist "%AVATAR_API%" (
    echo Mental Avatar API script not found: %AVATAR_API%
    exit /b 1
)

netstat -ano | findstr /R /C:":8766 .*LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Mental Avatar API already running on 8766
    exit /b 0
)

if exist "%AVATAR_PYTHON%" goto start_api
if exist "%AVATAR_ROOT%\.venv\Scripts\python.exe" (
    set "AVATAR_PYTHON=%AVATAR_ROOT%\.venv\Scripts\python.exe"
    goto start_api
)
set "AVATAR_PYTHON=python"

:start_api
start "Mental Avatar API" /min /d "%AVATAR_ROOT%" cmd /c ""%AVATAR_PYTHON%" "%AVATAR_API%" >> "%AVATAR_ROOT%\server_8766.log" 2>> "%AVATAR_ROOT%\server_8766_err.log""
echo Mental Avatar API started on 8766
