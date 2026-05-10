import { useState, KeyboardEvent } from 'react'
import { useBookmarks } from '@/store/useBookmarks'

export default function BookmarksCard() {
  const { bookmarks, add, remove } = useBookmarks()
  const [input, setInput] = useState('')

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      try {
        add(input.trim())
        setInput('')
      } catch {
        alert('올바른 URL을 입력해주세요')
      }
    }
  }

  function openUrl(url: string) {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {bookmarks.map(bm => (
            <div
              key={bm.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-hover hover:bg-surface-border cursor-pointer group transition-colors"
              onClick={() => openUrl(bm.url)}
            >
              <img
                src={bm.favicon}
                alt=""
                className="w-5 h-5 flex-shrink-0 rounded"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="flex-1 text-sm text-gray-300 truncate">{bm.title}</span>
              <button
                onClick={e => { e.stopPropagation(); remove(bm.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {bookmarks.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">북마크를 추가해보세요</p>
        )}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="URL 입력 후 Enter (예: github.com)"
        className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
      />
    </div>
  )
}
