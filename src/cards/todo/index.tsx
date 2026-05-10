import { useState, KeyboardEvent } from 'react'
import { useTodos } from '@/store/useTodos'

export default function TodoCard() {
  const { todos, add, toggle, remove, doneCount, total } = useTodos()
  const [input, setInput] = useState('')

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      add(input)
      setInput('')
    }
  }

  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{doneCount}/{total} 완료</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-surface-border rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggle(todo.id)}
              className="w-4 h-4 accent-[#7c6af7] cursor-pointer flex-shrink-0"
            />
            <span
              className={`flex-1 text-sm ${todo.done ? 'line-through text-gray-500' : 'text-gray-200'}`}
            >
              {todo.text}
            </span>
            <button
              onClick={() => remove(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
        {todos.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">할일을 추가해보세요</p>
        )}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="새 항목 입력 후 Enter"
        className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
      />
    </div>
  )
}
