import { useState, useEffect, useCallback, useRef } from 'react'
import type { Note } from '@/types'

const KEY = 'dash-notes'
const KG_API = 'http://127.0.0.1:8766'
const SYNC_DEBOUNCE_MS = 2000

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null)
  const syncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes))
  }, [notes])

  // 노트 변경을 KG에 반영 — 입력이 멎은 뒤(디바운스) 백그라운드로 동기화, 실패해도 무해
  const syncToKG = useCallback((note: Note) => {
    if (syncTimers.current[note.id]) clearTimeout(syncTimers.current[note.id])
    syncTimers.current[note.id] = setTimeout(() => {
      if (!note.content.trim()) return
      fetch(`${KG_API}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'note', source_id: note.id, title: note.title, content: note.content }),
      }).catch(() => {})
    }, SYNC_DEBOUNCE_MS)
  }, [])

  const create = useCallback((title = ''): string => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    setNotes(p => [{ id, title, content: '', tags: [], createdAt: now, updatedAt: now }, ...p])
    setActiveId(id)
    return id
  }, [])

  const update = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(p => {
      const idx = p.findIndex(n => n.id === id)
      if (idx === -1) return p
      const merged = { ...p[idx], ...patch, updatedAt: new Date().toISOString() }
      syncToKG(merged)
      const next = [...p]
      next[idx] = merged
      return next
    })
  }, [syncToKG])

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
