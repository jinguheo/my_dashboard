import { useState } from 'react'
import { useNotes } from '@/store/useNotes'

export default function NotesCard() {
  const { notes, activeNote, activeId, setActiveId, create, update, remove } = useNotes()
  const [showList, setShowList] = useState(false)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowList(v => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showList ? '◀ 닫기' : `📋 ${notes.length}개`}
        </button>
        <button
          onClick={create}
          className="ml-auto text-xs bg-accent hover:bg-accent-hover text-white px-2 py-1 rounded-md transition-colors"
        >
          + 새 노트
        </button>
      </div>

      {showList && (
        <div className="flex flex-col gap-1 max-h-28 overflow-y-auto border-b border-surface-border pb-2">
          {notes.map(n => (
            <div
              key={n.id}
              className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-sm ${
                n.id === activeId ? 'bg-accent/20 text-accent' : 'text-gray-300 hover:bg-surface-hover'
              }`}
            >
              <span className="flex-1 truncate" onClick={() => { setActiveId(n.id); setShowList(false) }}>
                {n.title || '(제목 없음)'}
              </span>
              <button
                onClick={() => remove(n.id)}
                className="text-gray-500 hover:text-red-400 text-xs ml-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {activeNote ? (
        <div className="flex flex-col flex-1 gap-2 min-h-0">
          <input
            value={activeNote.title}
            onChange={e => update(activeNote.id, { title: e.target.value })}
            className="w-full bg-transparent border-b border-surface-border text-gray-100 font-semibold focus:outline-none focus:border-accent pb-1"
            placeholder="제목"
          />
          <textarea
            value={activeNote.content}
            onChange={e => update(activeNote.id, { content: e.target.value })}
            className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-500 focus:outline-none resize-none"
            placeholder="마크다운으로 작성하세요..."
          />
          <span className="text-xs text-gray-600">
            {new Date(activeNote.updatedAt).toLocaleString('ko-KR')}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={create} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            + 첫 번째 노트 만들기
          </button>
        </div>
      )}
    </div>
  )
}
