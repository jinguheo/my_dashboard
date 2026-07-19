@echo off
setlocal
cd /d "%~dp0"

rem Always perform a clean restart for dashboard-related services.
rem This is intentionally limited to ports owned by this dashboard.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=@(5173,5174,8765,8766,8768); foreach($port in $ports){ $portPids=netstat -ano | Select-String (':' + $port + ' .*LISTENING') | ForEach-Object { $_.ToString().Trim().Split()[-1] } | Sort-Object -Unique; foreach($procId in $portPids){ if($procId -and $procId -ne '0'){ Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue } } }; Start-Sleep -Milliseconds 800"

rem Lightweight default: only start the dashboard essentials.
rem Optional heavy services can be enabled before running this file:
rem   set START_AVATAR_EXTRAS=1
rem   set START_CLAUDE_BROWSER=1
rem Keep restart responsive; avatar services can warm up on first use.
if not defined SKIP_AVATAR_WARMUP set "SKIP_AVATAR_WARMUP=1"

set "PYTHON_EXE=python"
if exist ".venv\Scripts\python.exe" set "PYTHON_EXE=.venv\Scripts\python.exe"

set "NPM_EXE=C:\Program Files\nodejs\npm.cmd"
if not exist "%NPM_EXE%" set "NPM_EXE=npm.cmd"

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul
if errorlevel 1 (
    start "MCP Server" /min "%PYTHON_EXE%" stock_mcp_server.py
    echo MCP server started
) else (
    echo MCP already running
)

rem Wait for MCP to bind before starting scripts/dev.js, which also checks MCP.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; for($i=0; $i -lt 20; $i++){ if(netstat -ano | Select-String ':8765 .*LISTENING'){ $ready=$true; break }; Start-Sleep -Milliseconds 500 }; if(-not $ready){ Write-Output 'MCP did not become ready before continuing' }"

call "%~dp0start_mental_avatar_api.bat"
set "AVATAR_AVAILABLE=%MENTAL_AVATAR_AVAILABLE%"

rem Preload XTTS on normal dashboard restarts so the first TTS is ready sooner.
rem Login startup skips blocking warmups until all UI servers are available.
if /I "%SKIP_AVATAR_WARMUP%"=="1" goto skip_avatar_preload
if /I not "%AVATAR_AVAILABLE%"=="1" goto skip_avatar_preload
powershell -NoProfile -WindowStyle Hidden -Command "$ready=$false; for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8766/avatar/xtts/ensure' -Method Post -TimeoutSec 20 | Out-Null; $ready=$true; break } } catch { Start-Sleep -Seconds 2 } }; if ($ready) { Write-Output 'XTTS warm-up triggered' } else { Write-Output 'XTTS warm-up skipped (API not ready)' }"

rem Preload STT as well so first speech recognition starts faster.
powershell -NoProfile -WindowStyle Hidden -Command "$ready=$false; for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8766/stt/warmup' -Method Post -TimeoutSec 120 | Out-Null; $ready=$true; break } } catch { Start-Sleep -Seconds 2 } }; if ($ready) { Write-Output 'STT warm-up triggered' } else { Write-Output 'STT warm-up skipped (API not ready)' }"

:skip_avatar_preload
netstat -ano | findstr ":5174" | findstr "LISTENING" >nul
if errorlevel 1 (
    if /I "%AVATAR_AVAILABLE%"=="1" (
        if exist "%MENTAL_AVATAR_ROOT%\frontend\package.json" (
            start "Mental Avatar Frontend" /min /d "%MENTAL_AVATAR_ROOT%\frontend" "C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --config "D:\MyWork\my-dashboard\mental-avatar-vite.config.mjs" --port 5174
            echo Mental Avatar frontend started on 5174
        ) else (
            echo Mental Avatar frontend skipped: %MENTAL_AVATAR_ROOT%\frontend not found
        )
    ) else (
        echo Mental Avatar frontend skipped: project not found
    )
) else (
    echo Mental Avatar frontend already running
)
:skip_avatar_warmup

rem Real3D (mental-avatar와 무관한 별도 프로젝트: 사진->MICA 3D 얼굴 형상 재구성, D:\MyWork\Real3D).
rem GPU 상주 로딩이라 기동에 10~20초 걸림 — 실패해도 대시보드 기동 자체는 막지 않음.
if not defined REAL3D_ROOT set "REAL3D_ROOT=D:\MyWork\Real3D"
if not defined REAL3D_PYTHON set "REAL3D_PYTHON=D:\condaenvs\mica\python.exe"
netstat -ano | findstr ":8769" | findstr "LISTENING" >nul
if errorlevel 1 (
    if exist "%REAL3D_PYTHON%" if exist "%REAL3D_ROOT%\server.py" (
        start "Real3D Server" /min /d "%REAL3D_ROOT%" "%REAL3D_PYTHON%" "%REAL3D_ROOT%\server.py"
        echo Real3D server started on 8769
    ) else (
        echo Real3D server skipped: python or server.py not found
    )
) else (
    echo Real3D server already running
)

if /I not "%START_AVATAR_EXTRAS%"=="1" goto skip_avatar

netstat -ano | findstr ":8768" | findstr "LISTENING" >nul
if errorlevel 1 (
    if defined XTTS_PYTHON (
        start "XTTS Worker" /min "%XTTS_PYTHON%" "%MENTAL_AVATAR_ROOT%\api\xtts_server.py"
        echo XTTS Worker started
    ) else (
        echo XTTS Worker skipped: set XTTS_PYTHON to enable
    )
) else (
    echo XTTS Worker already running
)

tasklist /FI "WINDOWTITLE eq Avatar Watcher" 2>nul | findstr "python" >nul
if errorlevel 1 (
    if exist "%MENTAL_AVATAR_ROOT%\watcher\file_watcher.py" (
        start "Avatar Watcher" /min "%MENTAL_AVATAR_PYTHON%" "%MENTAL_AVATAR_ROOT%\watcher\file_watcher.py"
        echo Avatar Watcher started
    ) else (
        echo Avatar Watcher skipped: watcher not found
    )
) else (
    echo Avatar Watcher already running
)

goto after_avatar

:skip_avatar
echo Mental Avatar extras skipped. Set START_AVATAR_EXTRAS=1 to enable.

:after_avatar
if /I not "%START_CLAUDE_BROWSER%"=="1" goto skip_claude_browser

netstat -ano | findstr ":9222" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Chrome already running with CDP
    goto after_claude_browser
)

tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | findstr "chrome.exe" >nul
if errorlevel 1 (
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --load-extension="%~dp0chrome-extension" --no-first-run --no-default-browser-check https://claude.ai
        echo Chrome started with CDP and extension
    ) else (
        echo Chrome skipped: Chrome executable not found
    )
) else (
    echo Chrome is running without CDP. Bridge may not work.
)
goto after_claude_browser

:skip_claude_browser
echo Claude browser bridge skipped. Set START_CLAUDE_BROWSER=1 to enable.

:after_claude_browser
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
    start "Dashboard Vite" /min /d "%~dp0" "C:\Program Files\nodejs\node.exe" "scripts\dev.js"
    echo Dashboard Vite started on 5173
) else (
    echo Dashboard Vite already running
)

rem Warm up XTTS and STT after the API is available, without blocking the UI startup.
start "Avatar Warmup" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\warmup_avatar_services.ps1"
echo Avatar TTS/STT warmup started in background
