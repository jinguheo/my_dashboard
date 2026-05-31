import { useState, useEffect, useCallback } from 'react'
import type { JournalEntry, JournalAnalysis } from '@/types'

const ENTRIES_KEY = 'dash-journal-entries'
const ANALYSIS_KEY = 'dash-journal-analysis'

function loadEntries(): JournalEntry[] {
  try { return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]') } catch { return [] }
}

function loadAnalysis(): JournalAnalysis | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries)
  const [analysis, setAnalysis] = useState<JournalAnalysis | null>(loadAnalysis)

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
  }, [entries])

  const addEntry = useCallback((content: string, tags: string[], autoTags: string[]) => {
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      content,
      tags,
      autoTags,
      createdAt: new Date().toISOString(),
    }
    setEntries(prev => [entry, ...prev])
    return entry
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<Pick<JournalEntry, 'content' | 'tags' | 'autoTags'>>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const saveAnalysis = useCallback((a: JournalAnalysis) => {
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(a))
    setAnalysis(a)
  }, [])

  const recentEntries = useCallback((days = 30): JournalEntry[] => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return entries.filter(e => new Date(e.createdAt).getTime() > cutoff)
  }, [entries])

  return { entries, analysis, addEntry, updateEntry, removeEntry, saveAnalysis, recentEntries }
}

export type JournalState = ReturnType<typeof useJournal>
