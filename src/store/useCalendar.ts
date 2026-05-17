import { useState, useEffect, useCallback } from 'react'
import type { CalendarEvent } from '@/types'

const KEY = 'dash-calendar'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(events))
  }, [events])

  const add = useCallback((title: string, date: string, time?: string, color = '#7c3aed') => {
    setEvents(p => [...p, { id: crypto.randomUUID(), title, date, time, color }])
  }, [])

  const remove = useCallback((id: string) => {
    setEvents(p => p.filter(e => e.id !== id))
  }, [])

  const forDate = useCallback((date: string) => {
    return events.filter(e => e.date === date)
  }, [events])

  const upcoming = useCallback((days = 7) => {
    const today = new Date().toISOString().split('T')[0]
    const limit = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
    return events
      .filter(e => e.date >= today && e.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [events])

  return { events, add, remove, forDate, upcoming }
}

export type CalendarState = ReturnType<typeof useCalendar>
