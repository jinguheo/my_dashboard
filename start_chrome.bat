@echo off
setlocal

rem Start Chrome with a remote debugging port for the optional Claude browser bridge.
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME_EXE%" (
    echo Chrome executable not found.
    exit /b 1
)

start "" "%CHROME_EXE%" --remote-debugging-port=9222 --load-extension="%~dp0chrome-extension" --no-first-run --no-default-browser-check https://claude.ai
