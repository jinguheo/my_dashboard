#!/usr/bin/env node
/**
 * 개발 서버 시작 스크립트
 * - 포트 5173~5180 에 걸린 프로세스 모두 종료 후 5173으로 고정 시작
 * - MCP 서버(8765)가 없으면 자동 시작
 */
import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dir, '..')
const VITE_PORT = 5173
const MCP_PORT  = 8765

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** netstat로 포트 점유 PID 목록 반환 */
function getPidsOnPort(port) {
  try {
    const out = execSync(
      `netstat -ano | findstr ":${port}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (!line.includes(`LISTENING`) && !line.includes(`ESTABLISHED`)) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    return [...pids]
  } catch { return [] }
}

function isPortUsed(port) { return getPidsOnPort(port).length > 0 }

function killPort(port) {
  const pids = getPidsOnPort(port)
  for (const pid of pids) {
    try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }) } catch {}
  }
  return pids.length > 0
}

async function ensurePortFree(port) {
  if (!isPortUsed(port)) return
  console.log(`[dev] 포트 ${port} 사용 중 → 종료 중...`)
  for (let i = 0; i < 6; i++) {
    const killed = killPort(port)
    if (killed) console.log(`  PID 종료 완료`)
    await sleep(400)
    if (!isPortUsed(port)) { console.log(`[dev] ✓ 포트 ${port} 해제됨`); return }
  }
  console.warn(`[dev] ⚠ 포트 ${port} 해제 실패`)
}

// ── 1. Vite 포트 범위(5173~5180) 전부 정리 ───────────
console.log('[dev] Vite 포트 확인 중...')
for (let p = VITE_PORT; p <= VITE_PORT + 7; p++) {
  await ensurePortFree(p)
}
console.log(`[dev] ✓ 포트 ${VITE_PORT} 준비됨`)

// ── 2. MCP 서버 확인 및 시작 ───────────────────────────
if (isPortUsed(MCP_PORT)) {
  console.log(`[dev] ✓ MCP 서버 실행 중 (포트 ${MCP_PORT})`)
} else {
  const serverFile = resolve(ROOT, 'stock_mcp_server.py')
  if (existsSync(serverFile)) {
    console.log('[dev] MCP 서버 시작 중...')
    spawn('python', [serverFile], {
      cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true,
    }).unref()
    for (let i = 0; i < 10; i++) {
      await sleep(500)
      if (isPortUsed(MCP_PORT)) {
        console.log(`[dev] ✓ MCP 서버 시작됨 (포트 ${MCP_PORT})`)
        break
      }
      if (i === 9) console.warn('[dev] ⚠ MCP 서버 응답 없음 — 수동으로 확인하세요')
    }
  } else {
    console.warn('[dev] ⚠ stock_mcp_server.py 없음')
  }
}

// ── 3. Vite 시작 ───────────────────────────────────────
console.log(`\n[dev] Vite 시작 → http://localhost:${VITE_PORT}\n`)
const vite = spawn(`npx vite --port ${VITE_PORT}`, {
  cwd: ROOT, stdio: 'inherit', shell: true,
})
vite.on('exit', code => process.exit(code ?? 0))
