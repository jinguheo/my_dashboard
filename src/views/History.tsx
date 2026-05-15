import { useState, useEffect } from 'react'
import { listSnapshotDates, loadSnapshot, type Snapshot } from '@/services/snapshot'

const PRIORITY_LABEL = { high: '높음', medium: '중간', low: '낮음' }
const PRIORITY_COLOR = { high: 'text-red-500', medium: 'text-amber-500', low: 'text-blue-500' }

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}

function formatSavedAt(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function History() {
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [tab, setTab] = useState<'todos' | 'notes' | 'briefing' | 'calendar'>('todos')

  useEffect(() => {
    const d = listSnapshotDates()
    setDates(d)
    if (d.length > 0) {
      setSelectedDate(d[0])
      setSnapshot(loadSnapshot(d[0]))
    }
  }, [])

  function selectDate(date: string) {
    setSelectedDate(date)
    setSnapshot(loadSnapshot(date))
    setTab('todos')
  }

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-4xl">📅</p>
          <p className="text-gray-500 text-sm">아직 저장된 기록이 없습니다.</p>
          <p className="text-gray-400 text-xs">앱을 처음 사용하는 날부터 자동으로 기록됩니다.</p>
        </div>
      </div>
    )
  }

  const completedTodos = snapshot?.todos.filter(t => t.done) ?? []
  const pendingTodos = snapshot?.todos.filter(t => !t.done) ?? []

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* 날짜 목록 */}
      <div className="w-52 shrink-0 bg-gray-50 border-r border-surface-border flex flex-col">
        <div className="p-3 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-gray-900">기록 ({dates.length}일)</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">최근 60일 자동 저장</p>
        </div>
        <div className="flex-1 overflow-auto">
          {dates.map(date => {
            const snap = loadSnapshot(date)
            const done = snap?.todos.filter(t => t.done).length ?? 0
            const total = snap?.todos.length ?? 0
            const isToday = date === new Date().toISOString().slice(0, 10)
            return (
              <button
                key={date}
                onClick={() => selectDate(date)}
                className={`w-full text-left px-3 py-2.5 border-b border-surface-border transition-colors ${
                  date === selectedDate ? 'bg-white border-l-2 border-l-gray-900' : 'hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-800">
                    {date.slice(5).replace('-', '/')}
                    {isToday && <span className="ml-1 text-[9px] text-gray-400">(오늘)</span>}
                  </p>
                  {total > 0 && (
                    <span className="text-[9px] text-gray-400">{done}/{total}</span>
                  )}
                </div>
                {snap?.briefing && (
                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{snap.briefing.slice(0, 30)}...</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 상세 내용 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {snapshot ? (
          <>
            <div className="px-6 py-3 border-b border-surface-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{formatDate(snapshot.date)}</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  저장 시각: {formatSavedAt(snapshot.savedAt)} · 할 일 {snapshot.todos.length}개 · 노트 {snapshot.notes.length}개
                </p>
              </div>
              <div className="flex gap-1">
                {(['todos', 'notes', 'briefing', 'calendar'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tab === t ? 'bg-gray-900 text-white' : 'bg-surface border border-surface-border text-gray-600 hover:bg-surface-hover'
                    }`}
                  >
                    {t === 'todos' ? '할 일' : t === 'notes' ? '노트' : t === 'briefing' ? 'AI 브리핑' : '일정'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {tab === 'todos' && (
                <div className="max-w-2xl space-y-5">
                  {completedTodos.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        완료 ({completedTodos.length})
                      </h3>
                      <div className="space-y-2">
                        {completedTodos.map(t => (
                          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-surface-border">
                            <span className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] shrink-0">✓</span>
                            <span className="text-sm text-gray-400 line-through flex-1">{t.text}</span>
                            <span className={`text-[10px] ${PRIORITY_COLOR[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                            {t.completedAt && (
                              <span className="text-[10px] text-gray-300">
                                {new Date(t.completedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {pendingTodos.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        미완료 ({pendingTodos.length})
                      </h3>
                      <div className="space-y-2">
                        {pendingTodos.map(t => (
                          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-surface-border">
                            <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                            <span className="text-sm text-gray-700 flex-1">{t.text}</span>
                            <span className={`text-[10px] ${PRIORITY_COLOR[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                            {t.dueDate && <span className="text-[10px] text-red-400">{t.dueDate}</span>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {snapshot.todos.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-8">이 날 할 일 기록이 없습니다.</p>
                  )}
                </div>
              )}

              {tab === 'notes' && (
                <div className="max-w-2xl space-y-3">
                  {snapshot.notes.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">이 날 노트 기록이 없습니다.</p>
                  ) : (
                    snapshot.notes.map(n => (
                      <div key={n.id} className="bg-white border border-surface-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">{n.title || '(제목 없음)'}</h4>
                          <span className="text-[10px] text-gray-400">
                            {new Date(n.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
                          {n.content || '(내용 없음)'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'briefing' && (
                <div className="max-w-2xl">
                  {snapshot.briefing ? (
                    <div className="bg-white border border-surface-border rounded-xl p-5">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{snapshot.briefing}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm text-center py-8">이 날 AI 브리핑이 생성되지 않았습니다.</p>
                  )}
                </div>
              )}

              {tab === 'calendar' && (
                <div className="max-w-2xl space-y-2">
                  {snapshot.calendarEvents.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">이 날 저장된 일정이 없습니다.</p>
                  ) : (
                    snapshot.calendarEvents
                      .filter(e => e.date === snapshot.date)
                      .concat(snapshot.calendarEvents.filter(e => e.date !== snapshot.date))
                      .map(e => (
                        <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-surface-border">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{e.title}</p>
                            <p className="text-xs text-gray-400">{e.date}{e.time ? ` ${e.time}` : ''}</p>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            날짜를 선택하세요
          </div>
        )}
      </div>
    </div>
  )
}
