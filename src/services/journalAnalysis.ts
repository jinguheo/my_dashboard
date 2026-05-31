import type { JournalEntry, JournalAnalysis } from '@/types'

const AVATAR_BASE = 'http://localhost:8766'
const MCP_ENDPOINT = 'http://127.0.0.1:8765/mcp'

export async function ingestJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (entries.length === 0) return
  const text = entries
    .map(e => `${e.createdAt.slice(0, 10)} [${e.tags.join(',')}] ${e.content}`)
    .join('\n')
  await fetch(`${AVATAR_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: 'journal', metadata: { date: new Date().toISOString().slice(0, 10) } }),
  })
}

export async function fetchAnalysis(): Promise<JournalAnalysis> {
  const res = await fetch(`${AVATAR_BASE}/profile/analysis`)
  if (!res.ok) throw new Error(`analysis fetch failed: ${res.status}`)
  const data = await res.json()
  const keywords: string[] = data.keywords ?? extractKeywords(data.report ?? '')
  return { keywords, analyzedAt: new Date().toISOString() }
}

function extractKeywords(report: string): string[] {
  const bold = [...report.matchAll(/\*\*(.+?)\*\*/g)].map(m => m[1])
  if (bold.length > 0) return bold.slice(0, 6)
  return report.split(/[,·\n]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 15).slice(0, 6)
}

export function scheduleMidnightAnalysis(
  getEntries: () => JournalEntry[],
  onComplete: (a: JournalAnalysis) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout>

  async function runAnalysis() {
    try {
      const entries = getEntries()
      await ingestJournalEntries(entries)
      const analysis = await fetchAnalysis()
      onComplete(analysis)
    } catch (e) {
      console.warn('Journal analysis failed:', e)
    }
  }

  function scheduleNext() {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setDate(midnight.getDate() + 1)
    midnight.setHours(0, 0, 0, 0)
    const msUntilMidnight = midnight.getTime() - now.getTime()
    timer = setTimeout(() => {
      runAnalysis()
      scheduleNext()
    }, msUntilMidnight)
  }

  scheduleNext()
  return () => clearTimeout(timer)
}

export async function suggestAutoTags(
  content: string,
  sessionKey: string,
): Promise<string[]> {
  if (!content.trim() || !sessionKey) return []
  try {
    const res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'claude.chat',
          arguments: {
            session_key: sessionKey,
            messages: [{
              role: 'user',
              content: `다음 짧은 기록에 어울리는 한국어 태그를 1~3개만 단어로 답해줘 (쉼표 구분, 설명 없이 태그만): ${content}`,
            }],
            system: '',
          },
        },
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const text: string = data?.result?.content?.[0]?.json?.text ?? data?.result?.content?.[0]?.text ?? ''
    return text.split(/[,，、]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0 && s.length < 10).slice(0, 3)
  } catch {
    return []
  }
}
