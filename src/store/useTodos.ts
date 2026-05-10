import { useState, useEffect } from 'react'
import type { Todo, Priority } from '@/types'

const KEY = 'dash-todos'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(todos))
  }, [todos])

  function add(text: string, priority: Priority = 'medium', category = '일반', dueDate?: string) {
    setTodos(p => [{
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      priority,
      category,
      dueDate,
      createdAt: new Date().toISOString(),
    }, ...p])
  }

  function toggle(id: string) {
    setTodos(p => p.map(t => t.id === id
      ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined }
      : t
    ))
  }

  function remove(id: string) {
    setTodos(p => p.filter(t => t.id !== id))
  }

  function update(id: string, patch: Partial<Todo>) {
    setTodos(p => p.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  const todayStr = new Date().toDateString()
  const completed = todos.filter(t => t.done)
  return {
    todos,
    pending: todos.filter(t => !t.done),
    completed,
    completedToday: todos.filter(t =>
      t.done && t.completedAt && new Date(t.completedAt).toDateString() === todayStr
    ),
    highPriority: todos.filter(t => !t.done && t.priority === 'high'),
    doneCount: completed.length,
    total: todos.length,
    add, toggle, remove, update,
  }
}

export type TodoState = ReturnType<typeof useTodos>
