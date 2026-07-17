$ErrorActionPreference = 'Stop'
$api = 'http://127.0.0.1:8766'
$log = Join-Path (Split-Path -Parent $PSScriptRoot) 'avatar-warmup.log'

function Log([string]$message) {
    Add-Content -LiteralPath $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message) -Encoding utf8
}

try {
    Log 'warmup started'

    $apiReady = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $health = Invoke-RestMethod -Uri "$api/health" -TimeoutSec 3
            if ($health.status -eq 'ok') { $apiReady = $true; break }
        } catch {}
        Start-Sleep -Seconds 2
    }
    if (-not $apiReady) { Log 'API did not become ready'; exit 1 }

    Log 'API ready; starting XTTS warmup'
    Invoke-RestMethod -Uri "$api/avatar/xtts/ensure" -Method Post -TimeoutSec 10 | Out-Null

    $xttsReady = $false
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $status = Invoke-RestMethod -Uri "$api/avatar/xtts/status" -TimeoutSec 3
            if ($status.running -eq $true) { $xttsReady = $true; break }
        } catch {}
        Start-Sleep -Seconds 2
    }
    if ($xttsReady) { Log 'XTTS ready' } else { Log 'XTTS still starting; continuing with STT warmup' }

    Log 'starting STT warmup'
    Invoke-RestMethod -Uri "$api/stt/warmup" -Method Post -TimeoutSec 180 | Out-Null
    Log 'STT ready; warmup complete'
} catch {
    Log ("warmup failed: " + $_.Exception.Message)
    exit 1
}
