import { useState, useCallback } from 'react'

const PREFIX = 'dash-dailylog-'

function todayKey() {
  return PREFIX + new Date().toISOString().slice(0, 10)
}

function readItems(date: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + date) || '[]')
  } catch { return [] }
}

function writeItems(date: string, items: string[]) {
  localStorage.setItem(PREFIX + date, JSON.stringify(items))
}

export interface DayLog {
  date: string
  items: string[]
}

export function useDailyLog() {
  const today = new Date().toISOString().slice(0, 10)
  const [items, setItems] = useState<string[]>(() => readItems(today))

  const add = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    setItems(prev => {
      const next = [...prev, t]
      writeItems(today, next)
      return next
    })
  }, [today])

  const remove = useCallback((index: number) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index)
      writeItems(today, next)
      return next
    })
  }, [today])

  const getWeekLogs = useCallback((): DayLog[] => {
    const logs: DayLog[] = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      logs.push({ date: d, items: readItems(d) })
    }
    return logs.filter(l => l.items.length > 0)
  }, [])

  return { todayKey: todayKey(), items, add, remove, getWeekLogs }
}

export type DailyLogState = ReturnType<typeof useDailyLog>
