import { lazy, Suspense, useState, useRef, useEffect } from 'react'
import type { NoteState } from '@/store/useNotes'

const MarkdownEditor = lazy(() => import('@/components/notes/MarkdownEditor'))
const MarkdownPreview = lazy(() => import('@/components/notes/MarkdownPreview'))

const theme = null
const remarkGfm = null
function markdown() { return null }
const EditorSelection = { cursor: (pos: number) => pos }

function ReactMarkdown({ children }: any) {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">미리보기를 불러오는 중...</p>}>
      <MarkdownPreview content={children || ''} />
    </Suspense>
  )
}

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

/** 공백 연속을 단일 스페이스로 압축하면서, 결과 문자열의 각 위치가 원본의 어느 인덱스에서 왔는지 기록한다 */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let inWs = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (/\s/.test(ch)) {
      if (!inWs) { norm += ' '; map.push(i); inWs = true }
    } else {
      norm += ch; map.push(i); inWs = false
    }
  }
  return { norm, map }
}

/**
 * 미리보기에서 더블클릭한 텍스트 노드/오프셋을 마크다운 원문(content) 내 위치로 매핑한다.
 * 렌더링된 텍스트는 보통 마크다운 문법 기호(**, #, [] 등)를 뺀 채로도 원문 안에 그대로
 * 부분 문자열로 남아있으므로(굵게/링크/헤딩 안쪽 텍스트 등), 공백을 정규화한 뒤
 * 부분 문자열 검색으로 위치를 찾는다. 일치하는 부분을 못 찾으면 null을 반환한다.
 */
function findSourcePosition(content: string, textNode: Text, clickOffset: number): number | null {
  const full = textNode.textContent || ''
  const trimmed = full.trim()
  if (!trimmed) return null
  const leadWs = full.length - full.replace(/^\s+/, '').length

  const { norm: needleNorm, map: needleMap } = normalizeWithMap(trimmed)
  if (!needleNorm) return null
  const { norm: contentNorm, map: contentMap } = normalizeWithMap(content)

  let localOffset = clickOffset - leadWs
  localOffset = Math.max(0, Math.min(localOffset, trimmed.length))

  let needleNormOffset = needleMap.findIndex(idx => idx >= localOffset)
  if (needleNormOffset === -1) needleNormOffset = needleNorm.length

  // 정확히 일치하는 부분이 없으면 끝에서 단어 단위로 줄여가며 재시도
  let needle = needleNorm
  let matchIdx = -1
  while (needle.length > 0) {
    matchIdx = contentNorm.indexOf(needle)
    if (matchIdx !== -1) break
    const cut = needle.replace(/\s*\S+\s*$/, '')
    if (!cut || cut === needle) break
    needle = cut
  }
  if (matchIdx === -1) return null

  const targetNormOffset = Math.min(needleNormOffset, needle.length)
  const targetContentIdx = matchIdx + targetNormOffset
  if (targetContentIdx >= contentMap.length) return content.length
  return contentMap[targetContentIdx]
}

type ViewMode = 'edit' | 'preview'
type ListLayout = 'list' | 'grid'
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
  const [mode, setMode] = useState<ViewMode>('edit')
  const [layout, setLayout] = useState<ListLayout>('list')
  const [search, setSearch] = useState('')
  const [, forceUpdate] = useState(0)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef(activeId)
  const noteStateRef = useRef(noteState)
  const pendingCursorRef = useRef<number | null>(null)

  function CodeMirror({ value, onChange }: any) {
    return (
      <Suspense fallback={<div className="text-sm text-gray-400">에디터를 불러오는 중...</div>}>
        <MarkdownEditor value={value} onChange={onChange} pendingCursorRef={pendingCursorRef} />
      </Suspense>
    )
  }

  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { noteStateRef.current = noteState }, [noteState])

  const activeNote = noteState.notes.find(n => n.id === activeId) ?? null

  const filteredNotes = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return noteState.notes
    return noteState.notes.filter(n =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  })()

  // document 캡처 단계에서 paste 가로채기
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const wrap = editorWrapRef.current
      if (!wrap) return
      if (!wrap.contains(e.target as Node)) return

      const rawHtml = e.clipboardData?.getData('text/html') ?? ''
      if (!rawHtml.trim()) return

      e.stopImmediatePropagation()
      e.preventDefault()

      const [{ default: DOMPurify }, { default: TurndownService }] = await Promise.all([
        import('dompurify'),
        import('turndown'),
      ])
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
    setMode('edit')
  }

  /** 미리보기 더블클릭 → 클릭 위치에 대응하는 마크다운 소스 위치로 커서를 옮기고 편집 모드로 전환 */
  function handlePreviewDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!activeNote) return
    const docAny = document as any
    let node: Node | null = null
    let offset = 0
    if (docAny.caretRangeFromPoint) {
      const range = docAny.caretRangeFromPoint(e.clientX, e.clientY)
      if (range) { node = range.startContainer; offset = range.startOffset }
    } else if (docAny.caretPositionFromPoint) {
      const pos = docAny.caretPositionFromPoint(e.clientX, e.clientY)
      if (pos) { node = pos.offsetNode; offset = pos.offset }
    }

    pendingCursorRef.current = (node && node.nodeType === Node.TEXT_NODE)
      ? findSourcePosition(activeNote.content, node as Text, offset)
      : null
    setMode('edit')
  }

  function handleDelete(id: string) {
    clearHtml(id)
    noteState.remove(id)
    const remaining = noteState.notes.filter(n => n.id !== id)
    setActiveId(remaining[0]?.id ?? null)
  }

  return (
    <div className="view-canvas flex flex-1 overflow-hidden">
      {/* 노트 목록 */}
      <div className={`${activeNote ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-surface-border bg-white/70 md:w-56`}>
        <div className="p-3 border-b border-surface-border flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-gray-900">📝 노트</span>
          <div className="flex items-center gap-1">
            {/* 레이아웃 토글 */}
            <button
              onClick={() => setLayout(l => l === 'list' ? 'grid' : 'list')}
              title={layout === 'list' ? '아이콘 보기' : '목록 보기'}
              className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition-colors"
            >
              {layout === 'list' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="0" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="0" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="0" y="1" width="12" height="2" rx="1" fill="currentColor"/>
                  <rect x="0" y="5" width="12" height="2" rx="1" fill="currentColor"/>
                  <rect x="0" y="9" width="12" height="2" rx="1" fill="currentColor"/>
                </svg>
              )}
            </button>
            <button
              onClick={handleCreate}
              className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center text-sm transition-colors"
            >+</button>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-surface-border">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 8L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="노트 검색..."
              className="w-full pl-7 pr-6 py-1.5 text-xs bg-white border border-surface-border rounded-md outline-none focus:border-gray-400 placeholder-gray-400 text-gray-800"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none"
              >×</button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {noteState.notes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">노트가 없습니다.<br />+ 버튼으로 만들어보세요.</p>
          ) : filteredNotes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">검색 결과가 없습니다.</p>
          ) : layout === 'list' ? (
            filteredNotes.map(note => (
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
            ))
          ) : (
            <div className="p-2 grid grid-cols-2 gap-2">
              {filteredNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setActiveId(note.id)}
                  title={note.title || '(제목 없음)'}
                  className={`relative group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                    note.id === activeId
                      ? 'bg-white border-gray-900 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                    note.id === activeId ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {note.title ? note.title[0].toUpperCase() : '📝'}
                  </div>
                  <p className="text-[10px] font-medium text-gray-800 line-clamp-2 text-center leading-tight w-full">
                    {note.title || '(제목 없음)'}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs leading-none transition-all"
                  >×</button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeNote ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-surface-border px-3 py-3 sm:gap-3 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="노트 목록으로 돌아가기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-white text-gray-600 md:hidden"
            >
              ←
            </button>
            <input
              aria-label="노트 제목"
              value={activeNote.title}
              onChange={e => noteState.update(activeNote.id, { title: e.target.value })}
              placeholder="제목"
              className="flex-1 bg-transparent text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none min-w-0"
            />
            <span className="text-xs text-gray-400 shrink-0">{relativeTime(activeNote.updatedAt)} 수정</span>
            <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs shrink-0">
              {(['edit', 'preview'] as ViewMode[]).map((m, i) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-surface-border' : ''} ${
                    mode === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}>
                  {m === 'edit' ? '편집' : '미리보기'}
                </button>
              ))}
            </div>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-hidden flex min-h-0">
            {mode === 'edit' && (
              <div
                ref={editorWrapRef}
                className="flex-1 overflow-auto px-4 py-4 sm:px-6"
              >
                <CodeMirror
                  value={activeNote.content}
                  onChange={(val: string) => {
                    clearHtml(activeNote.id) // 직접 편집 시 HTML 캐시 제거
                    noteState.update(activeNote.id, { content: val })
                  }}
                  onCreateEditor={(view: any) => {
                    const pos = pendingCursorRef.current
                    if (pos !== null) {
                      const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
                      view.dispatch({ selection: EditorSelection.cursor(clamped), scrollIntoView: true })
                      view.focus()
                      pendingCursorRef.current = null
                    }
                  }}
                  extensions={[markdown(), theme]}
                  placeholder="Claude 채팅 내용을 붙여넣거나 마크다운으로 작성하세요..."
                  basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true, searchKeymap: false, completionKeymap: false }}
                  style={{ fontSize: '14px', minHeight: '100%' }}
                />
              </div>
            )}
            {mode === 'preview' && (
              <div
                className="flex-1 overflow-auto px-4 py-4 sm:px-6"
                onDoubleClick={handlePreviewDoubleClick}
                title="더블클릭하면 해당 위치의 편집 화면으로 이동합니다"
              >
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
