import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import type { NoteState } from '@/store/useNotes'

const theme = EditorView.theme({
  '&': { background: 'transparent', color: '#111827' },
  '.cm-editor': { background: 'transparent' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-content': { caretColor: '#111827', padding: '8px 0' },
  '.cm-line': { padding: '0 4px' },
  '.cm-cursor': { borderLeftColor: '#111827' },
  '.cm-activeLine': { background: 'rgba(0,0,0,0.03)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(0,0,0,0.08) !important' },
})

interface Props { notes: NoteState }

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function Notes({ notes: noteState }: Props) {
  const [activeId, setActiveId] = useState<string | null>(noteState.notes[0]?.id ?? null)

  const activeNote = noteState.notes.find(n => n.id === activeId) ?? null

  function handleCreate() {
    const id = noteState.create()
    setActiveId(id)
  }

  function handleDelete(id: string) {
    noteState.remove(id)
    const remaining = noteState.notes.filter(n => n.id !== id)
    setActiveId(remaining[0]?.id ?? null)
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="w-56 shrink-0 bg-gray-50 border-r border-surface-border flex flex-col">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">📝 노트</span>
          <button
            onClick={handleCreate}
            className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center text-sm transition-colors"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {noteState.notes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">노트가 없습니다.<br />+ 버튼으로 만들어보세요.</p>
          ) : (
            noteState.notes.map(note => (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-surface-border transition-colors group relative ${
                  note.id === activeId ? 'bg-white border-l-2 border-l-gray-900' : 'hover:bg-white'
                }`}
              >
                <p className="text-xs font-medium text-gray-800 line-clamp-1 pr-4">{note.title || '(제목 없음)'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                  {note.content.slice(0, 40) || '(내용 없음)'}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">{relativeTime(note.updatedAt)}</p>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-sm transition-all"
                >
                  ×
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {activeNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-surface-border flex items-center gap-3">
            <input
              value={activeNote.title}
              onChange={e => noteState.update(activeNote.id, { title: e.target.value })}
              placeholder="제목"
              className="flex-1 bg-transparent text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none"
            />
            <span className="text-xs text-gray-400">{relativeTime(activeNote.updatedAt)} 수정</span>
          </div>
          <div className="flex-1 overflow-auto px-6 py-4">
            <CodeMirror
              value={activeNote.content}
              onChange={val => noteState.update(activeNote.id, { content: val })}
              extensions={[markdown(), theme]}
              placeholder="마크다운으로 작성하세요..."
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                searchKeymap: false,
                completionKeymap: false,
              }}
              style={{ fontSize: '14px', minHeight: '100%' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-4xl">📝</p>
            <p className="text-gray-400 text-sm">노트를 선택하거나 새로 만들어보세요</p>
            <button onClick={handleCreate} className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
              새 노트 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
