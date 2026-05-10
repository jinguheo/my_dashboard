import { useState, useEffect } from 'react'
import type { View, Settings } from '@/types'
import type { TodoState } from '@/store/useTodos'
import type { NoteState } from '@/store/useNotes'
import type { CalendarState } from '@/store/useCalendar'
import { fetchWeather, weatherEmoji, type WeatherData } from '@/services/weather'
import { streamChat, briefingSystem, buildBriefingMessage } from '@/services/claude'

interface Props {
  todos: TodoState
  notes: NoteState
  calendar: CalendarState
  settings: Settings
  onNavigate: (v: View) => void
}

const PRIORITY_COLOR = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-blue-400' }
const PRIORITY_LABEL = { high: '높음', medium: '중간', low: '낮음' }

function formatDate() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function Dashboard({ todos, notes, calendar, settings, onNavigate }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [briefing, setBriefing] = useState(() => localStorage.getItem(`briefing-${new Date().toISOString().slice(0, 10)}`) || '')
  const [loadingBriefing, setLoadingBriefing] = useState(false)

  useEffect(() => {
    if (settings.weatherApiKey && settings.city) {
      fetchWeather(settings.city, settings.weatherApiKey)
        .then(setWeather)
        .catch(() => {})
    }
  }, [settings.weatherApiKey, settings.city])

  async function generateBriefing() {
    if (!settings.anthropicApiKey) {
      onNavigate('settings')
      return
    }
    setLoadingBriefing(true)
    setBriefing('')
    const msg = buildBriefingMessage({
      pending: todos.pending.map(t => t.text),
      highPriority: todos.highPriority.map(t => t.text),
      completedToday: todos.completedToday.map(t => t.text),
      upcomingEvents: calendar.upcoming(7).map(e => `${e.date} ${e.title}`),
      recentNotes: notes.notes.slice(0, 3).map(n => n.title),
    })
    let result = ''
    await streamChat(settings.anthropicApiKey, [{ role: 'user', content: msg }], briefingSystem(settings.userName), (delta) => {
      result += delta
      setBriefing(result)
    })
    localStorage.setItem(`briefing-${new Date().toISOString().slice(0, 10)}`, result)
    setLoadingBriefing(false)
  }

  const upcoming = calendar.upcoming(7)

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">안녕하세요, {settings.userName}님 👋</h1>
          <p className="text-gray-400 text-sm mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button onClick={() => onNavigate('todos')} className="px-3 py-1.5 bg-surface rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-colors">
            할 일 관리 →
          </button>
          <button onClick={() => onNavigate('ai')} className="px-3 py-1.5 bg-accent rounded-lg text-white hover:bg-accent-hover transition-colors">
            AI 대화 →
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="남은 할 일"
          value={todos.pending.length}
          sub={`완료 ${todos.completedToday.length}개 (오늘)`}
          color="text-blue-400"
          onClick={() => onNavigate('todos')}
        />
        <StatCard
          label="높은 우선순위"
          value={todos.highPriority.length}
          sub="즉시 처리 필요"
          color="text-red-400"
          onClick={() => onNavigate('todos')}
        />
        <StatCard
          label="노트"
          value={notes.notes.length}
          sub={notes.notes[0] ? `최근: ${relativeTime(notes.notes[0].updatedAt)}` : '작성된 노트 없음'}
          color="text-purple-400"
          onClick={() => onNavigate('notes')}
        />
        {weather ? (
          <div className="bg-surface rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors">
            <div className="text-3xl mb-1">{weatherEmoji(weather.icon)}</div>
            <div className="text-2xl font-bold text-white">{weather.temp}°C</div>
            <div className="text-xs text-gray-400 mt-0.5">{weather.city} · {weather.description}</div>
            <div className="text-xs text-gray-500 mt-1">체감 {weather.feelsLike}°C · 습도 {weather.humidity}%</div>
          </div>
        ) : (
          <StatCard
            label="날씨"
            value="—"
            sub={settings.weatherApiKey ? '로딩 중...' : '설정에서 API 키 입력'}
            color="text-gray-400"
            onClick={() => onNavigate('settings')}
          />
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* High Priority Todos */}
        <div className="col-span-1 bg-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">🔴 높은 우선순위</h2>
            <button onClick={() => onNavigate('todos')} className="text-xs text-gray-500 hover:text-accent">전체 보기</button>
          </div>
          {todos.highPriority.length === 0 ? (
            <p className="text-gray-500 text-xs py-4 text-center">높은 우선순위 할 일 없음</p>
          ) : (
            <ul className="space-y-2">
              {todos.highPriority.slice(0, 5).map(t => (
                <li key={t.id} className="flex items-start gap-2">
                  <button
                    onClick={() => todos.toggle(t.id)}
                    className="mt-0.5 w-4 h-4 rounded border border-red-400/50 shrink-0 hover:bg-red-400/20 transition-colors"
                  />
                  <div className="min-w-0">
                    <span className="text-sm text-gray-200 line-clamp-1">{t.text}</span>
                    {t.dueDate && <span className="text-xs text-red-400">마감: {t.dueDate}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI Briefing */}
        <div className="col-span-1 bg-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">✦ AI 브리핑</h2>
            <button
              onClick={generateBriefing}
              disabled={loadingBriefing}
              className="text-xs px-2 py-1 bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {loadingBriefing ? '생성 중...' : '생성'}
            </button>
          </div>
          {briefing ? (
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{briefing}</p>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <span className="text-3xl">🤖</span>
              <p className="text-xs text-gray-500 text-center">
                {settings.anthropicApiKey
                  ? "'생성' 버튼을 눌러 오늘의 브리핑을 받아보세요"
                  : '설정에서 Anthropic API 키를 입력하세요'}
              </p>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="col-span-1 bg-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">📅 다가오는 일정</h2>
            <button onClick={() => onNavigate('calendar')} className="text-xs text-gray-500 hover:text-accent">캘린더</button>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-xs py-4 text-center">7일 내 일정 없음</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 5).map(e => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 line-clamp-1">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.date}{e.time ? ` ${e.time}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Notes */}
        <div className="col-span-2 bg-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">📝 최근 노트</h2>
            <button onClick={() => onNavigate('notes')} className="text-xs text-gray-500 hover:text-accent">전체 보기</button>
          </div>
          {notes.notes.length === 0 ? (
            <p className="text-gray-500 text-xs py-4 text-center">작성된 노트가 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {notes.notes.slice(0, 4).map(n => (
                <div key={n.id} className="bg-surface-card rounded-lg p-3 hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => onNavigate('notes')}>
                  <p className="text-sm font-medium text-gray-200 line-clamp-1">{n.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{n.content || '(내용 없음)'}</p>
                  <p className="text-[10px] text-gray-600 mt-2">{relativeTime(n.updatedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Todo Progress */}
        <div className="col-span-1 bg-surface rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-white text-sm">📊 오늘 현황</h2>
          <div className="space-y-2">
            {(['high', 'medium', 'low'] as const).map(p => {
              const count = todos.pending.filter(t => t.priority === p).length
              return (
                <div key={p} className="flex items-center justify-between">
                  <span className={`text-xs ${PRIORITY_COLOR[p]}`}>{PRIORITY_LABEL[p]}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: todos.pending.length ? `${(count / todos.pending.length) * 100}%` : '0%',
                          background: p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#3b82f6',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="pt-2 border-t border-surface-border">
            <div className="flex justify-between text-xs text-gray-400">
              <span>전체 진행률</span>
              <span>{todos.todos.length > 0
                ? `${Math.round((todos.completed.length / todos.todos.length) * 100)}%`
                : '0%'
              }</span>
            </div>
            <div className="mt-1 w-full h-2 bg-surface-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: todos.todos.length > 0 ? `${(todos.completed.length / todos.todos.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: number | string; sub: string; color: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-surface rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors"
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}
