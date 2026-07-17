@echo off
setlocal

if not defined MENTAL_AVATAR_ROOT (
    for %%I in ("%~dp0..\mental-avatar") do set "MENTAL_AVATAR_ROOT=%%~fI"
)
set "AVATAR_ROOT=%MENTAL_AVATAR_ROOT%"
set "AVATAR_API=%AVATAR_ROOT%\api\server.py"
if defined MENTAL_AVATAR_PYTHON (
    set "AVATAR_PYTHON=%MENTAL_AVATAR_PYTHON%"
) else (
    set "AVATAR_PYTHON=%AVATAR_ROOT%\.venv\Scripts\python.exe"
)

if not exist "%AVATAR_PYTHON%" if exist "C:\Users\oem\miniconda3\envs\avatar\python.exe" set "AVATAR_PYTHON=C:\Users\oem\miniconda3\envs\avatar\python.exe"

if not exist "%AVATAR_API%" (
    echo Mental Avatar API script not found: %AVATAR_API%
    endlocal & set "MENTAL_AVATAR_AVAILABLE=0" & exit /b 0
)

netstat -ano | findstr /R /C:":8766 .*LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Mental Avatar API already running on 8766
    endlocal & set "MENTAL_AVATAR_AVAILABLE=1" & set "MENTAL_AVATAR_ROOT=%AVATAR_ROOT%" & set "MENTAL_AVATAR_PYTHON=%AVATAR_PYTHON%" & exit /b 0
)

if exist "%AVATAR_PYTHON%" goto start_api
set "AVATAR_PYTHON=python"

:start_api
start "Mental Avatar API" /min /d "%AVATAR_ROOT%" "%AVATAR_PYTHON%" "%AVATAR_API%"
echo Mental Avatar API started on 8766
endlocal & set "MENTAL_AVATAR_AVAILABLE=1" & set "MENTAL_AVATAR_ROOT=%AVATAR_ROOT%" & set "MENTAL_AVATAR_PYTHON=%AVATAR_PYTHON%"
