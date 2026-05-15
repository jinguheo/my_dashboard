import type { Todo, Note, CalendarEvent } from '@/types'

export interface Snapshot {
  date: string
  savedAt: string
  todos: Todo[]
  notes: Note[]
  calendarEvents: CalendarEvent[]
  briefing: string
  completedCount: number
}

const PREFIX = 'dash-snapshot-'
const MAX_DAYS = 60

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function saveSnapshot(data: Omit<Snapshot, 'date' | 'savedAt'>) {
  const date = todayStr()
  const snapshot: Snapshot = { ...data, date, savedAt: new Date().toISOString() }
  localStorage.setItem(PREFIX + date, JSON.stringify(snapshot))
  pruneOld()
}

export function loadSnapshot(date: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(PREFIX + date)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function listSnapshotDates(): string[] {
  const dates: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) dates.push(key.slice(PREFIX.length))
  }
  return dates.sort((a, b) => b.localeCompare(a))
}

export function hasSnapshotToday(): boolean {
  return !!localStorage.getItem(PREFIX + todayStr())
}

function pruneOld() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - MAX_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) {
      const date = key.slice(PREFIX.length)
      if (date < cutoffStr) localStorage.removeItem(key)
    }
  }
}
