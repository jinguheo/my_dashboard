import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Todo, Priority } from '@/types'
import { logActivity } from '@/services/activityLog'

const KEY = 'dash-todos'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(todos))
  }, [todos])

  const add = useCallback((text: string, priority: Priority = 'medium', category = '일반', dueDate?: string) => {
    setTodos(p => [{
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      priority,
      category,
      dueDate,
      createdAt: new Date().toISOString(),
    }, ...p])
  }, [])

  const toggle = useCallback((id: string) => {
    setTodos(p => p.map(t => {
      if (t.id !== id) return t
      if (!t.done) logActivity('todo-done', `할 일 완료: ${t.text.slice(0, 20)}`)
      return { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined }
    }))
  }, [])

  const remove = useCallback((id: string) => {
    setTodos(p => p.filter(t => t.id !== id))
  }, [])

  const update = useCallback((id: string, patch: Partial<Todo>) => {
    setTodos(p => p.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const todayStr = new Date().toDateString()

  const pending = useMemo(() => todos.filter(t => !t.done), [todos])
  const completed = useMemo(() => todos.filter(t => t.done), [todos])
  const completedToday = useMemo(
    () => todos.filter(t => t.done && t.completedAt && new Date(t.completedAt).toDateString() === todayStr),
    [todos, todayStr],
  )
  const highPriority = useMemo(() => todos.filter(t => !t.done && t.priority === 'high'), [todos])

  return {
    todos,
    pending,
    completed,
    completedToday,
    highPriority,
    doneCount: completed.length,
    total: todos.length,
    add, toggle, remove, update,
  }
}

export type TodoState = ReturnType<typeof useTodos>
