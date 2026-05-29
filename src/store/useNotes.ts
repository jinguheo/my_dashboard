import { useState, useEffect, useCallback } from 'react'
import type { Note } from '@/types'

const KEY = 'dash-notes'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes))
  }, [notes])

  const create = useCallback((title = ''): string => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    setNotes(p => [{ id, title, content: '', tags: [], createdAt: now, updatedAt: now }, ...p])
    setActiveId(id)
    return id
  }, [])

  const update = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(p => p.map(n => n.id === id
      ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
    ))
  }, [])

  const remove = useCallback((id: string) => {
    setNotes(p => {
      const remaining = p.filter(n => n.id !== id)
      setActiveId(current => current === id ? (remaining[0]?.id ?? null) : current)
      return remaining
    })
  }, [])

  const activeNote = notes.find(n => n.id === activeId) ?? notes[0] ?? null

  return { notes, activeId: activeNote?.id ?? null, activeNote, setActiveId, create, update, remove }
}

export type NoteState = ReturnType<typeof useNotes>
