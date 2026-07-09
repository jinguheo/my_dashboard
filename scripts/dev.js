#!/usr/bin/env node
import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const VITE_PORT = 5173
const MCP_PORT = 8765
const TTS_PORT = 8767
const START_TTS = process.env.START_TTS === '1'
const PYTHON_EXE = existsSync(resolve(ROOT, '.venv', 'Scripts', 'python.exe'))
  ? resolve(ROOT, '.venv', 'Scripts', 'python.exe')
  : 'python'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function getPidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING') && !line.includes('ESTABLISHED')) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    return [...pids]
  } catch {
    return []
  }
}

function isPortUsed(port) {
  return getPidsOnPort(port).length > 0
}

function killPort(port) {
  const pids = getPidsOnPort(port)
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } catch {}
  }
  return pids.length > 0
}

async function ensurePortFree(port) {
  if (!isPortUsed(port)) return
  console.log(`[dev] port ${port} in use, stopping...`)
  for (let i = 0; i < 6; i++) {
    const killed = killPort(port)
    if (killed) console.log('  stopped')
    await sleep(400)
    if (!isPortUsed(port)) {
      console.log(`[dev] port ${port} freed`)
      return
    }
  }
  console.warn(`[dev] failed to free port ${port}`)
}

console.log('[dev] checking Vite ports')
for (let p = VITE_PORT; p <= VITE_PORT + 7; p++) {
  await ensurePortFree(p)
}
console.log(`[dev] port ${VITE_PORT} ready`)

if (isPortUsed(MCP_PORT)) {
  console.log(`[dev] MCP server already running (${MCP_PORT})`)
} else {
  const serverFile = resolve(ROOT, 'stock_mcp_server.py')
  if (existsSync(serverFile)) {
    console.log('[dev] starting MCP server')
    spawn(PYTHON_EXE, [serverFile], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref()
    for (let i = 0; i < 10; i++) {
      await sleep(500)
      if (isPortUsed(MCP_PORT)) {
        console.log(`[dev] MCP server started (${MCP_PORT})`)
        break
      }
      if (i === 9) console.warn('[dev] MCP server did not respond; check manually')
    }
  } else {
    console.warn('[dev] stock_mcp_server.py not found')
  }
}

if (!START_TTS) {
  console.log('[dev] TTS server skipped (set START_TTS=1 to enable)')
} else if (isPortUsed(TTS_PORT)) {
  console.log(`[dev] TTS server already running (${TTS_PORT})`)
} else {
  const ttsFile = resolve(ROOT, 'tts_server.py')
  if (existsSync(ttsFile)) {
    console.log('[dev] starting TTS server')
    spawn(PYTHON_EXE, [ttsFile], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref()
    for (let i = 0; i < 10; i++) {
      await sleep(500)
      if (isPortUsed(TTS_PORT)) {
        console.log(`[dev] TTS server started (${TTS_PORT})`)
        break
      }
      if (i === 9) console.warn('[dev] TTS server did not respond; check manually')
    }
  } else {
    console.warn('[dev] tts_server.py not found')
  }
}

console.log(`\n[dev] starting Vite on http://localhost:${VITE_PORT}\n`)
const vite = spawn(`npx vite --port ${VITE_PORT}`, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})
vite.on('exit', code => process.exit(code ?? 0))
