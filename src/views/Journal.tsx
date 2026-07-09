import { useState, useEffect, useRef, useCallback } from 'react'
import { useJournal } from '@/store/useJournal'
import type { JournalEntry, JournalAnalysis } from '@/types'
import { suggestAutoTags, scheduleMidnightAnalysis } from '@/services/journalAnalysis'

const FIXED_TAGS = ['업무', '일상', '영화', '책', '음악', '운동', '식사', '기타'] as const

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  업무: { bg: '#fef3c7', text: '#92400e' },
  일상: { bg: '#f0fdf4', text: '#166534' },
  영화: { bg: '#dbeafe', text: '#1e40af' },
  책:   { bg: '#fce7f3', text: '#9d174d' },
  음악: { bg: '#fdf4ff', text: '#7e22ce' },
  운동: { bg: '#dcfce7', text: '#15803d' },
  식사: { bg: '#fef9c3', text: '#a16207' },
  기타: { bg: '#f3f4f6', text: '#374151' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

interface Props {
  sessionKey: string
}

export default function Journal({ sessionKey }: Props) {
  const journal = useJournal()
  const { entries, analysis, addEntry, updateEntry, removeEntry, saveAnalysis, recentEntries } = journal

  useEffect(() => {
    const cancel = scheduleMidnightAnalysis(() => recentEntries(30), saveAnalysis)
    return cancel
  }, [recentEntries, saveAnalysis])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AnalysisBanner analysis={analysis} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <EntryForm
          onSave={(content, tags, autoTags) => addEntry(content, tags, autoTags)}
          sessionKey={sessionKey}
        />
        <CardGrid entries={entries} onUpdate={updateEntry} onRemove={removeEntry} />
      </div>
    </div>
  )
}

// ── 배너 ──────────────────────────────────────────────────

function AnalysisBanner({ analysis }: { analysis: JournalAnalysis | null }) {
  const lastDate = analysis?.analyzedAt
    ? new Date(analysis.analyzedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : null

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
      style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
      <span className="text-xs font-bold shrink-0" style={{ color: '#16a34a' }}>✦ 나 분석</span>
      {analysis && analysis.keywords.length > 0 ? (
        <div className="flex gap-2 flex-wrap flex-1">
          {analysis.keywords.map(kw => (
            <span key={kw} className="text-xs px-3 py-0.5 rounded-full font-medium"
              style={{ background: '#dcfce7', color: '#15803d' }}>
              {kw}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs flex-1" style={{ color: '#6b7280' }}>
          아직 분석 없음 — 기록이 쌓이면 자동 분석됩니다
        </span>
      )}
      {lastDate && (
        <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>
          {lastDate} 분석 · 다음 자정 갱신
        </span>
      )}
    </div>
  )
}

// ── 입력폼 ────────────────────────────────────────────────

function EntryForm({ onSave, sessionKey }: {
  onSave: (content: string, tags: string[], autoTags: string[]) => void
  sessionKey: string
}) {
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [autoTags, setAutoTags] = useState<string[]>([])
  const [selectedAutoTags, setSelectedAutoTags] = useState<string[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleContentChange = useCallback((val: string) => {
    setContent(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setAutoTags([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoadingTags(true)
      const tags = await suggestAutoTags(val, sessionKey)
      setAutoTags(tags)
      setSelectedAutoTags([])
      setLoadingTags(false)
    }, 500)
  }, [sessionKey])

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const toggleAutoTag = (tag: string) =>
    setSelectedAutoTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const handleSave = () => {
    if (!content.trim()) return
    onSave(content.trim(), selectedTags, selectedAutoTags)
    setContent('')
    setSelectedTags([])
    setAutoTags([])
    setSelectedAutoTags([])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
      <textarea
        className="w-full resize-none border-none outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
        style={{ minHeight: 56 }}
        placeholder="오늘 있었던 일, 본 것, 느낀 것을 짧게 남겨요..."
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {FIXED_TAGS.map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={selectedTags.includes(tag)
              ? { background: '#111827', color: 'white' }
              : { background: '#f3f4f6', color: '#374151' }}>
            {tag}
          </button>
        ))}
        {loadingTags && <span className="text-xs text-gray-400">✦ 추천 중...</span>}
        {autoTags.map(tag => (
          <button key={tag} onClick={() => toggleAutoTag(tag)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={selectedAutoTags.includes(tag)
              ? { background: '#7c3aed', color: 'white' }
              : { background: '#ede9fe', color: '#7c3aed' }}>
            ✦ {tag}
          </button>
        ))}
        <button onClick={handleSave} disabled={!content.trim()}
          className="ml-auto text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
          style={{ background: '#111827', color: 'white' }}>
          저장
        </button>
      </div>
    </div>
  )
}

// ── 카드 그리드 ───────────────────────────────────────────

function CardGrid({ entries, onUpdate, onRemove }: {
  entries: JournalEntry[]
  onUpdate: (id: string, patch: Partial<Pick<JournalEntry, 'content' | 'tags' | 'autoTags'>>) => void
  onRemove: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-16">
        아직 기록이 없어요. 첫 번째 기록을 남겨보세요!
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {entries.map(entry => (
          <JournalCard key={entry.id} entry={entry} onClick={() => setEditingId(entry.id)} />
        ))}
      </div>
      {editingId && (
        <EditModal
          entry={entries.find(e => e.id === editingId)!}
          onSave={patch => { onUpdate(editingId, patch); setEditingId(null) }}
          onDelete={() => { onRemove(editingId); setEditingId(null) }}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  )
}

function JournalCard({ entry, onClick }: { entry: JournalEntry; onClick: () => void }) {
  const firstTag = entry.tags[0]
  const color = firstTag ? (TAG_COLORS[firstTag] ?? TAG_COLORS['기타']) : TAG_COLORS['기타']

  return (
    <div onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {firstTag
          ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color.bg, color: color.text }}>{firstTag}</span>
          : <span />}
        <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
      </div>
      <p className="text-xs text-gray-800 leading-relaxed line-clamp-3">{entry.content}</p>
      {entry.autoTags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {entry.autoTags.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: '#ede9fe', color: '#7c3aed' }}>
              ✦ {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 편집 모달 ─────────────────────────────────────────────

function EditModal({ entry, onSave, onDelete, onClose }: {
  entry: JournalEntry
  onSave: (patch: Partial<Pick<JournalEntry, 'content' | 'tags' | 'autoTags'>>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [content, setContent] = useState(entry.content)
  const [tags, setTags] = useState<string[]>(entry.tags)

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">기록 편집</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">×</button>
        </div>
        <textarea
          className="w-full resize-none border border-gray-200 rounded-lg p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
          style={{ minHeight: 100 }}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {FIXED_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={tags.includes(tag)
                ? { background: '#111827', color: 'white' }
                : { background: '#f3f4f6', color: '#374151' }}>
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onDelete}
            className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            삭제
          </button>
          <button onClick={() => onSave({ content: content.trim(), tags })}
            disabled={!content.trim()}
            className="text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{ background: '#111827', color: 'white' }}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
