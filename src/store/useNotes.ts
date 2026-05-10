import { useState, useEffect } from 'react'
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

  function create(title = '새 노트'): string {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    setNotes(p => [{ id, title, content: '', tags: [], createdAt: now, updatedAt: now }, ...p])
    setActiveId(id)
    return id
  }

  function update(id: string, patch: Partial<Note>) {
    setNotes(p => p.map(n => n.id === id
      ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
    ))
  }

  function remove(id: string) {
    setNotes(p => p.filter(n => n.id !== id))
    setActiveId(current => {
      if (current !== id) return current
      const remaining = notes.filter(n => n.id !== id)
      return remaining[0]?.id ?? null
    })
  }

  const activeNote = notes.find(n => n.id === activeId) ?? notes[0] ?? null

  return { notes, activeId: activeNote?.id ?? null, activeNote, setActiveId, create, update, remove }
}

export type NoteState = ReturnType<typeof useNotes>
