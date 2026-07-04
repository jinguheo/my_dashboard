import { useState } from 'react'
import type { TodoState } from '@/store/useTodos'
import type { Priority } from '@/types'

const PRIORITY_COLOR = {
  high: 'bg-red-50 text-red-600 border-red-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
}
const PRIORITY_LABEL = { high: '높음', medium: '중간', low: '낮음' }

type Filter = 'all' | 'pending' | 'done' | 'high'

interface Props { todos: TodoState }

export default function Todos({ todos }: Props) {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [category, setCategory] = useState('일반')
  const [dueDate, setDueDate] = useState('')
  const [filter, setFilter] = useState<Filter>('pending')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    todos.add(text, priority, category || '일반', dueDate || undefined)
    setText('')
    setDueDate('')
  }

  const filtered = (() => {
    if (filter === 'pending') return todos.pending
    if (filter === 'done') return todos.completed
    if (filter === 'high') return todos.highPriority
    return todos.todos
  })()

  const sorted = [...filtered].sort((a, b) => {
    const po = { high: 0, medium: 1, low: 2 }
    return !a.done && !b.done ? po[a.priority] - po[b.priority] : 0
  })

  return (
    <div className="view-canvas flex-1 overflow-auto">
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <p className="dashboard-kicker mb-1">Tasks</p>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-gray-950">할 일</h1>

      <form onSubmit={handleAdd} className="view-panel mb-5 space-y-3 p-4">
        <input
          aria-label="새로운 할 일"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="새로운 할 일을 입력하세요..."
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
        />
        <div className="flex gap-2 flex-wrap">
          <select
            aria-label="우선순위"
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="bg-white border border-surface-border text-sm text-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="high">🔴 높음</option>
            <option value="medium">🟡 중간</option>
            <option value="low">🔵 낮음</option>
          </select>
          <input
            aria-label="카테고리"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="카테고리"
            className="bg-white border border-surface-border text-sm text-gray-700 rounded-lg px-3 py-1.5 w-28 outline-none focus:ring-1 focus:ring-gray-400"
          />
          <input
            aria-label="마감일"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="bg-white border border-surface-border text-sm text-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            type="submit"
            className="ml-auto px-4 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            + 추가
          </button>
        </div>
      </form>

      <div className="flex gap-2 mb-4">
        {([['all', '전체'], ['pending', '미완료'], ['done', '완료'], ['high', '높은 우선순위']] as const).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-surface border border-surface-border text-gray-600 hover:bg-surface-hover'
            }`}
          >
            {label}
            <span className="ml-1 text-[10px] opacity-70">
              {f === 'all' ? todos.todos.length
                : f === 'pending' ? todos.pending.length
                : f === 'done' ? todos.completed.length
                : todos.highPriority.length}
            </span>
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          오늘 완료: {todos.completedToday.length}개
        </span>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="view-empty">할 일이 없습니다.</div>
        ) : (
          sorted.map(todo => (
            <div
              key={todo.id}
              className={`flex items-start gap-3 bg-white border border-surface-border rounded-xl px-4 py-3 group transition-colors ${
                todo.done ? 'opacity-50' : 'hover:bg-surface-hover'
              }`}
            >
              <button
                onClick={() => todos.toggle(todo.id)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                  todo.done
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'border-gray-300 hover:border-gray-600'
                }`}
              >
                {todo.done && <span className="text-xs">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${todo.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {todo.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[todo.priority]}`}>
                    {PRIORITY_LABEL[todo.priority]}
                  </span>
                  {todo.category && (
                    <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {todo.category}
                    </span>
                  )}
                  {todo.dueDate && (
                    <span className="text-[10px] text-orange-500">마감: {todo.dueDate}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => todos.remove(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-lg leading-none mt-0.5"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  )
}
