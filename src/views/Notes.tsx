import { useState, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
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

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
td.addRule('table', {
  filter: ['table'],
  replacement: (_: string, node: Node) => {
    const el = node as HTMLTableElement
    const rows = Array.from(el.querySelectorAll('tr'))
    if (!rows.length) return ''
    const toMd = (row: Element) =>
      '| ' + Array.from(row.querySelectorAll('th,td')).map(c => c.textContent?.trim() ?? '').join(' | ') + ' |'
    const header = toMd(rows[0])
    const sep = '| ' + Array.from(rows[0].querySelectorAll('th,td')).map(() => '---').join(' | ') + ' |'
    const body = rows.slice(1).map(toMd).join('\n')
    return '\n\n' + [header, sep, body].filter(Boolean).join('\n') + '\n\n'
  },
})

const HTML_KEY = (id: string) => `dash-note-html-${id}`

function saveHtml(id: string, html: string) {
  localStorage.setItem(HTML_KEY(id), html)
}
function loadHtml(id: string): string | null {
  return localStorage.getItem(HTML_KEY(id))
}
function clearHtml(id: string) {
  localStorage.removeItem(HTML_KEY(id))
}

type ViewMode = 'edit' | 'split' | 'preview'
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

function PreviewPane({ noteId, content }: { noteId: string; content: string }) {
  const html = loadHtml(noteId)
  if (html) {
    return (
      <div
        className="prose prose-sm max-w-none text-gray-900
          prose-headings:font-semibold prose-headings:text-gray-900
          prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
          prose-p:leading-7 prose-p:text-gray-700
          prose-strong:text-gray-900
          prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-auto
          prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600 prose-blockquote:pl-4
          prose-ul:list-disc prose-ol:list-decimal prose-li:text-gray-700
          prose-a:text-blue-600 prose-a:underline prose-hr:border-gray-200
          prose-table:w-full prose-table:border-collapse prose-thead:bg-gray-50
          prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
          prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return (
    <div className="prose prose-sm max-w-none text-gray-900
      prose-headings:font-semibold prose-headings:text-gray-900
      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
      prose-p:leading-7 prose-p:text-gray-700
      prose-strong:text-gray-900
      prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
      prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-auto
      prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600 prose-blockquote:pl-4
      prose-ul:list-disc prose-ol:list-decimal prose-li:text-gray-700
      prose-a:text-blue-600 prose-a:underline prose-hr:border-gray-200
      prose-table:w-full prose-table:border-collapse prose-thead:bg-gray-50
      prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
      prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content || '*내용이 없습니다.*'}
      </ReactMarkdown>
    </div>
  )
}

export default function Notes({ notes: noteState }: Props) {
  const [activeId, setActiveId] = useState<string | null>(noteState.notes[0]?.id ?? null)
  const [mode, setMode] = useState<ViewMode>('split')
  const [, forceUpdate] = useState(0)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef(activeId)
  const noteStateRef = useRef(noteState)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { noteStateRef.current = noteState }, [noteState])

  const activeNote = noteState.notes.find(n => n.id === activeId) ?? null

  // document 캡처 단계에서 paste 가로채기
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const wrap = editorWrapRef.current
      if (!wrap) return
      if (!wrap.contains(e.target as Node)) return

      const rawHtml = e.clipboardData?.getData('text/html') ?? ''
      if (!rawHtml.trim()) return

      e.stopImmediatePropagation()
      e.preventDefault()

      const cleanHtml = DOMPurify.sanitize(rawHtml, { FORBID_TAGS: ['style', 'script'] })
      const mdText = td.turndown(cleanHtml)

      const id = activeIdRef.current
      if (!id) return

      saveHtml(id, cleanHtml)
      noteStateRef.current.update(id, { content: mdText })
      forceUpdate(n => n + 1) // 미리보기 갱신
    }

    document.addEventListener('paste', onPaste, true)
    return () => document.removeEventListener('paste', onPaste, true)
  }, [])

  function handleCreate() {
    const id = noteState.create()
    setActiveId(id)
    setMode('split')
  }

  function handleDelete(id: string) {
    clearHtml(id)
    noteState.remove(id)
    const remaining = noteState.notes.filter(n => n.id !== id)
    setActiveId(remaining[0]?.id ?? null)
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* 노트 목록 */}
      <div className="w-56 shrink-0 bg-gray-50 border-r border-surface-border flex flex-col">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">📝 노트</span>
          <button
            onClick={handleCreate}
            className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center text-sm transition-colors"
          >+</button>
        </div>
        <div className="flex-1 overflow-auto">
          {noteState.notes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">노트가 없습니다.<br />+ 버튼으로 만들어보세요.</p>
          ) : noteState.notes.map(note => (
            <button
              key={note.id}
              onClick={() => setActiveId(note.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-surface-border transition-colors group relative ${
                note.id === activeId ? 'bg-white border-l-2 border-l-gray-900' : 'hover:bg-white'
              }`}
            >
              <p className="text-xs font-medium text-gray-800 line-clamp-1 pr-4">{note.title || '(제목 없음)'}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{note.content.slice(0, 40) || '(내용 없음)'}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{relativeTime(note.updatedAt)}</p>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-sm transition-all"
              >×</button>
            </button>
          ))}
        </div>
      </div>

      {activeNote ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 헤더 */}
          <div className="px-6 py-3 border-b border-surface-border flex items-center gap-3 shrink-0">
            <input
              value={activeNote.title}
              onChange={e => noteState.update(activeNote.id, { title: e.target.value })}
              placeholder="제목"
              className="flex-1 bg-transparent text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none min-w-0"
            />
            <span className="text-xs text-gray-400 shrink-0">{relativeTime(activeNote.updatedAt)} 수정</span>
            <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs shrink-0">
              {(['edit', 'split', 'preview'] as ViewMode[]).map((m, i) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-surface-border' : ''} ${
                    mode === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}>
                  {m === 'edit' ? '편집' : m === 'split' ? '분할' : '미리보기'}
                </button>
              ))}
            </div>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-hidden flex min-h-0">
            {(mode === 'edit' || mode === 'split') && (
              <div
                ref={editorWrapRef}
                className={`overflow-auto px-6 py-4 ${mode === 'split' ? 'w-1/2 border-r border-surface-border' : 'flex-1'}`}
              >
                <CodeMirror
                  value={activeNote.content}
                  onChange={val => {
                    clearHtml(activeNote.id) // 직접 편집 시 HTML 캐시 제거
                    noteState.update(activeNote.id, { content: val })
                  }}
                  extensions={[markdown(), theme]}
                  placeholder="Claude 채팅 내용을 붙여넣거나 마크다운으로 작성하세요..."
                  basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true, searchKeymap: false, completionKeymap: false }}
                  style={{ fontSize: '14px', minHeight: '100%' }}
                />
              </div>
            )}
            {(mode === 'preview' || mode === 'split') && (
              <div className={`overflow-auto px-6 py-4 ${mode === 'split' ? 'w-1/2' : 'flex-1'}`}>
                <PreviewPane noteId={activeNote.id} content={activeNote.content} />
              </div>
            )}
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
