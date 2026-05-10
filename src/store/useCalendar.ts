import { useState, useEffect } from 'react'
import type { CalendarEvent } from '@/types'

const KEY = 'dash-calendar'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(events))
  }, [events])

  function add(title: string, date: string, time?: string, color = '#7c3aed') {
    setEvents(p => [...p, { id: crypto.randomUUID(), title, date, time, color }])
  }

  function remove(id: string) {
    setEvents(p => p.filter(e => e.id !== id))
  }

  function forDate(date: string) {
    return events.filter(e => e.date === date)
  }

  function upcoming(days = 7) {
    const today = new Date().toISOString().split('T')[0]
    const limit = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
    return events
      .filter(e => e.date >= today && e.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return { events, add, remove, forDate, upcoming }
}

export type CalendarState = ReturnType<typeof useCalendar>
