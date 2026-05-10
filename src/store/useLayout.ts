import { useState, useEffect } from 'react'
import { Layout } from 'react-grid-layout'
import { CardInstance } from '@/types/card'

const STORAGE_KEY = 'dashboard-layout'

const defaultInstances: CardInstance[] = [
  { id: 'inst-todo',      cardId: 'todo',      layout: { i: 'inst-todo',      x: 0, y: 0, w: 3, h: 4 } },
  { id: 'inst-notes',     cardId: 'notes',     layout: { i: 'inst-notes',     x: 3, y: 0, w: 3, h: 4 } },
  { id: 'inst-email',     cardId: 'email',     layout: { i: 'inst-email',     x: 6, y: 0, w: 3, h: 4 } },
  { id: 'inst-chat',      cardId: 'chat',      layout: { i: 'inst-chat',      x: 9, y: 0, w: 3, h: 4 } },
  { id: 'inst-pdf',       cardId: 'pdf',       layout: { i: 'inst-pdf',       x: 0, y: 4, w: 6, h: 4 } },
  { id: 'inst-bookmarks', cardId: 'bookmarks', layout: { i: 'inst-bookmarks', x: 6, y: 4, w: 6, h: 4 } },
]

export function useLayout() {
  const [instances, setInstances] = useState<CardInstance[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : defaultInstances
    } catch {
      return defaultInstances
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(instances))
  }, [instances])

  const layouts = instances.map(i => i.layout)

  function onLayoutChange(newLayouts: Layout[]) {
    setInstances(prev =>
      prev.map(inst => ({
        ...inst,
        layout: newLayouts.find(l => l.i === inst.id) ?? inst.layout,
      }))
    )
  }

  function addCard(cardId: string, defaultSize: { w: number; h: number }) {
    const id = `inst-${cardId}-${Date.now()}`
    const newInstance: CardInstance = {
      id,
      cardId,
      layout: { i: id, x: 0, y: Infinity, w: defaultSize.w, h: defaultSize.h },
    }
    setInstances(prev => [...prev, newInstance])
  }

  function removeCard(instanceId: string) {
    setInstances(prev => prev.filter(i => i.id !== instanceId))
  }

  return { instances, layouts, onLayoutChange, addCard, removeCard }
}
