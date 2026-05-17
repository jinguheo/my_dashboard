const PREFIX = 'dash-activity-'
const COOLDOWN = 30 * 60 * 1000  // 같은 type은 30분 내 재기록 없음

export interface ActivityEntry {
  ts: number
  time: string
  type: string
  label: string
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function read(date = todayDate()): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(PREFIX + date) || '[]') } catch { return [] }
}

function write(entries: ActivityEntry[], date = todayDate()) {
  localStorage.setItem(PREFIX + date, JSON.stringify(entries))
  window.dispatchEvent(new CustomEvent('activity-logged'))
}

export function logActivity(type: string, label: string) {
  const entries = read()
  const now = Date.now()
  const last = [...entries].reverse().find(e => e.type === type)
  if (last && now - last.ts < COOLDOWN) return

  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  write([...entries, { ts: now, time, type, label }])
}

export function getTodayActivities(): ActivityEntry[] {
  return read()
}

export function removeActivity(ts: number) {
  write(read().filter(e => e.ts !== ts))
}
