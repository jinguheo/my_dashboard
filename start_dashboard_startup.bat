@echo off
setlocal
cd /d "%~dp0"

rem A clean login startup prevents stale partial services from blocking a full restart.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=@(5173,5174,8765,8766,8768); foreach($port in $ports){ $portPids=netstat -ano | Select-String (':' + $port + ' .*LISTENING') | ForEach-Object { $_.ToString().Trim().Split()[-1] } | Sort-Object -Unique; foreach($procId in $portPids){ if($procId -and $procId -ne '0'){ Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue } } }"

set "SKIP_AVATAR_WARMUP=1"
call "%~dp0start_dashboard.bat"
endlocal
