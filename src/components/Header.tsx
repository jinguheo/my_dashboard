import { useState } from 'react'

interface Props {
  onAddCard: () => void
  darkMode: boolean
  onToggleDark: () => void
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '좋은 아침이에요'
  if (h < 18) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

function formatDate(d: Date) {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

export default function Header({ onAddCard, darkMode, onToggleDark }: Props) {
  const [now] = useState(new Date())

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-surface border-b border-surface-border flex-shrink-0 drag-handle-titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex gap-1.5">
          <button onClick={() => window.electronAPI?.close()} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
          <button onClick={() => window.electronAPI?.minimize()} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
          <button onClick={() => window.electronAPI?.maximize()} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span>📅</span>
        <span>{formatDate(now)}</span>
        <span className="text-gray-600">·</span>
        <span>{getGreeting()}, Jingu</span>
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onToggleDark}
          className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded transition-colors"
          title={darkMode ? '라이트모드' : '다크모드'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button
          onClick={onAddCard}
          className="flex items-center gap-1 text-sm bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <span>+</span>
          <span>카드 추가</span>
        </button>
      </div>
    </header>
  )
}
