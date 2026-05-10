import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AIMessage, View, Settings } from '@/types'
import type { TodoState } from '@/store/useTodos'
import type { NoteState } from '@/store/useNotes'
import type { CalendarState } from '@/store/useCalendar'
import { fetchWeather, weatherEmoji, type WeatherData } from '@/services/weather'
import { streamChat, briefingSystem, strategicSystem, buildBriefingMessage } from '@/services/claude'
import {
  displaySymbol,
  fetchWatchlist,
  fetchWatchlistFromMcp,
  fmtChange,
  fmtPrice,
  type StockQuote,
} from '@/services/stocks'
import { useBookmarks } from '@/store/useBookmarks'

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

function parseSymbols(value: string) {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function isToday(date?: string) {
  if (!date) return false
  return date === new Date().toISOString().slice(0, 10)
}

function openExternalUrl(url: string) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export default function Dashboard({ todos, notes, calendar, settings, onNavigate }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [briefing, setBriefing] = useState(() => localStorage.getItem(`briefing-${new Date().toISOString().slice(0, 10)}`) || '')
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockSource, setStockSource] = useState<'api-key' | 'mcp' | null>(null)
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [shortcutUrl, setShortcutUrl] = useState('')
  const [shortcutError, setShortcutError] = useState('')
  const aiBottomRef = useRef<HTMLDivElement>(null)
  const { bookmarks, add: addBookmark, remove: removeBookmark } = useBookmarks()

  const symbols = useMemo(() => parseSymbols(settings.stockSymbols || ''), [settings.stockSymbols])
  const routine = useMemo(
    () => (settings.dailyRoutine || '').split('\n').map(v => v.trim()).filter(Boolean),
    [settings.dailyRoutine],
  )
  const todayTodos = todos.pending.filter(t => isToday(t.dueDate)).slice(0, 5)
  const upcoming = calendar.upcoming(7)

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  useEffect(() => {
    if (settings.weatherApiKey && settings.city) {
      fetchWeather(settings.city, settings.weatherApiKey)
        .then(setWeather)
        .catch(() => {})
    }
  }, [settings.weatherApiKey, settings.city])

  useEffect(() => {
    if (settings.dataAccessMode === 'api-key' && settings.finnhubApiKey && symbols.length) {
      loadStocksViaApiKey()
    }
    if (settings.dataAccessMode === 'mcp' && settings.mcpEndpoint && symbols.length) {
      loadStocksViaMcp()
    }
  }, [settings.dataAccessMode, settings.finnhubApiKey, settings.mcpEndpoint, symbols.join('|')])

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
      upcomingEvents: upcoming.map(e => `${e.date} ${e.title}`),
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

  function buildAiContext(): string {
    const pending = todos.pending.map(t => `[${t.priority}] ${t.text}`).join('\n')
    const completed = todos.completedToday.map(t => t.text).join(', ')
    const events = upcoming.map(e => `${e.date} ${e.time || ''} ${e.title}`.trim()).join('\n')
    const recentNotes = notes.notes.slice(0, 4).map(n => `- ${n.title}: ${n.content.slice(0, 120)}`).join('\n')
    const stockSummary = stocks.map(q => `${q.symbol}: ${fmtPrice(q)} ${fmtChange(q)}`).join('\n')
    const routineSummary = routine.map(item => `- ${item}`).join('\n')

    return [
      `[현재 대시보드 상황]`,
      `매일 하는 일:\n${routineSummary || '없음'}`,
      `미완료 할 일:\n${pending || '없음'}`,
      `오늘 완료: ${completed || '없음'}`,
      `다가오는 일정:\n${events || '없음'}`,
      `최근 노트:\n${recentNotes || '없음'}`,
      `주식 정보:\n${stockSummary || '아직 불러오지 않음'}`,
    ].join('\n\n')
  }

  async function sendAiQuestion(question?: string) {
    const content = (question ?? aiInput).trim()
    if (!content || aiLoading) return
    if (!settings.anthropicApiKey) {
      onNavigate('settings')
      return
    }

    setAiInput('')
    setAiLoading(true)

    const userMessage: AIMessage = { role: 'user', content, timestamp: new Date().toISOString() }
    const assistantMessage: AIMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    const nextMessages = [...aiMessages, userMessage, assistantMessage]
    setAiMessages(nextMessages)

    const answerIndex = nextMessages.length - 1
    const history = nextMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    try {
      await streamChat(
        settings.anthropicApiKey,
        history,
        `${strategicSystem(settings.userName)}\n\n${buildAiContext()}`,
        (delta) => {
          setAiMessages(p => p.map((m, i) => i === answerIndex ? { ...m, content: m.content + delta } : m))
        },
      )
    } finally {
      setAiLoading(false)
    }
  }

  async function loadStocksViaApiKey() {
    if (!settings.finnhubApiKey) {
      setStockError('설정에서 Finnhub API 키를 입력해주세요.')
      onNavigate('settings')
      return
    }
    await loadStocks('api-key', () => fetchWatchlist(symbols, settings.finnhubApiKey))
  }

  async function loadStocksViaMcp() {
    if (!settings.mcpEndpoint) {
      setStockError('설정에서 MCP 엔드포인트를 입력해주세요.')
      onNavigate('settings')
      return
    }
    await loadStocks('mcp', () => fetchWatchlistFromMcp(settings.mcpEndpoint, symbols))
  }

  async function loadStocks(source: 'api-key' | 'mcp', loader: () => Promise<StockQuote[]>) {
    if (!symbols.length) {
      setStockError('설정에서 관심 종목을 입력해주세요.')
      onNavigate('settings')
      return
    }
    setStocksLoading(true)
    setStockError('')
    setStockSource(source)
    try {
      const data = await loader()
      setStocks(data)
      if (!data.length) setStockError('가져온 주식 정보가 없습니다.')
    } catch (err) {
      setStockError(err instanceof Error ? err.message : '주식 정보를 가져오지 못했습니다.')
    } finally {
      setStocksLoading(false)
    }
  }

  function handleAddShortcut(e: React.FormEvent) {
    e.preventDefault()
    const value = shortcutUrl.trim()
    if (!value) return
    try {
      addBookmark(value)
      setShortcutUrl('')
      setShortcutError('')
    } catch {
      setShortcutError('올바른 URL을 입력해주세요. 예: youtube.com 또는 https://example.com')
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">안녕하세요, {settings.userName}님</h1>
          <p className="text-gray-400 text-sm mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button onClick={() => onNavigate('todos')} className="px-3 py-1.5 bg-surface rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-colors">
            할 일 관리
          </button>
          <button onClick={() => onNavigate('settings')} className="px-3 py-1.5 bg-surface rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-colors">
            연결 설정
          </button>
          <button onClick={() => onNavigate('ai')} className="px-3 py-1.5 bg-accent rounded-lg text-white hover:bg-accent-hover transition-colors">
            AI 브리핑
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="남은 할 일"
          value={todos.pending.length}
          sub={`오늘 완료 ${todos.completedToday.length}개`}
          color="text-blue-400"
          onClick={() => onNavigate('todos')}
        />
        <StatCard
          label="높은 우선순위"
          value={todos.highPriority.length}
          sub="먼저 확인할 일"
          color="text-red-400"
          onClick={() => onNavigate('todos')}
        />
        <StatCard
          label="노트"
          value={notes.notes.length}
          sub={notes.notes[0] ? `최근: ${relativeTime(notes.notes[0].updatedAt)}` : '작성한 노트 없음'}
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
            value="-"
            sub={settings.weatherApiKey ? '로딩 중...' : '설정에서 API 키 입력'}
            color="text-gray-400"
            onClick={() => onNavigate('settings')}
          />
        )}
      </div>

      <Panel title="빠른 바로가기" className="!space-y-3">
        <form onSubmit={handleAddShortcut} className="flex gap-2">
          <input
            value={shortcutUrl}
            onChange={e => {
              setShortcutUrl(e.target.value)
              if (shortcutError) setShortcutError('')
            }}
            placeholder="바로가기 URL 추가: youtube.com, docs.google.com ..."
            className="flex-1 bg-surface-card rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50"
          />
          <button
            type="submit"
            disabled={!shortcutUrl.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            추가
          </button>
        </form>
        {shortcutError && <p className="text-xs text-red-400">{shortcutError}</p>}
        <div className="grid grid-cols-5 gap-2">
          {bookmarks.map(link => (
            <div
              key={link.id}
              className="group relative rounded-xl bg-surface-card text-xs text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
            >
              <button
                onClick={() => openExternalUrl(link.url)}
                className="flex w-full flex-col items-center gap-2 px-2 py-3"
                title={link.title}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10">
                  <img
                    src={link.favicon}
                    alt=""
                    className="h-6 w-6 rounded"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </span>
                <span className="max-w-full truncate">{link.title}</span>
              </button>
              <button
                onClick={() => removeBookmark(link.id)}
                className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/40 text-xs text-gray-400 hover:text-red-300 group-hover:flex"
                title="바로가기 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-4">
        <Panel title="매일 하는 일" actionLabel="할 일 보기" onAction={() => onNavigate('todos')}>
          {routine.length === 0 && todayTodos.length === 0 ? (
            <EmptyText>설정에서 매일 하는 일을 추가하거나 오늘 마감 할 일을 등록하세요.</EmptyText>
          ) : (
            <div className="space-y-3">
              {routine.length > 0 && (
                <ul className="space-y-2">
                  {routine.slice(0, 6).map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                      <span className="line-clamp-1">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {todayTodos.length > 0 && (
                <div className="pt-3 border-t border-surface-border space-y-2">
                  <p className="text-xs text-gray-500">오늘 마감</p>
                  {todayTodos.map(t => (
                    <button key={t.id} onClick={() => todos.toggle(t.id)} className="flex w-full items-center gap-2 text-left text-sm text-gray-200 hover:text-accent">
                      <span className="h-4 w-4 rounded border border-surface-border shrink-0" />
                      <span className="line-clamp-1">{t.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="주식 정보" className="col-span-2" actionLabel="설정" onAction={() => onNavigate('settings')}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              onClick={loadStocksViaApiKey}
              disabled={stocksLoading}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50"
            >
              API_KEY로 가져오기
            </button>
            <button
              onClick={loadStocksViaMcp}
              disabled={stocksLoading}
              className="px-3 py-1.5 rounded-lg bg-surface-card text-gray-200 text-xs font-medium hover:bg-surface-hover disabled:opacity-50"
            >
              MCP로 가져오기
            </button>
            <span className="text-xs text-gray-600">
              {stockSource ? `최근 연결: ${stockSource === 'api-key' ? 'API_KEY' : 'MCP'}` : '관심 종목을 설정하고 가져오세요'}
            </span>
          </div>
          {stockError && <p className="mb-3 text-xs text-red-400">{stockError}</p>}
          {stocks.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {stocks.slice(0, 6).map(q => (
                <div key={q.symbol} className="bg-surface-card rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{displaySymbol(q.symbol)}</span>
                    <span className={`text-xs ${q.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtChange(q)}</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-100">{fmtPrice(q)}</div>
                  <div className="mt-1 text-[10px] text-gray-600">고가 {fmtPrice({ ...q, price: q.high })} · 저가 {fmtPrice({ ...q, price: q.low })}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyText>{stocksLoading ? '주식 정보를 가져오는 중입니다...' : 'Finnhub API 키 또는 MCP 브리지를 연결하면 관심 종목이 표시됩니다.'}</EmptyText>
          )}
        </Panel>

        <Panel title="높은 우선순위" actionLabel="전체 보기" onAction={() => onNavigate('todos')}>
          {todos.highPriority.length === 0 ? (
            <EmptyText>높은 우선순위 할 일이 없습니다.</EmptyText>
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
        </Panel>

        <Panel title="AI 브리핑">
          <div className="flex items-center justify-end -mt-8 mb-2">
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
            <EmptyText>{settings.anthropicApiKey ? '생성 버튼을 눌러 오늘의 브리핑을 받아보세요.' : '설정에서 Anthropic API 키를 입력하세요.'}</EmptyText>
          )}
        </Panel>

        <Panel title="다가오는 일정" actionLabel="캘린더" onAction={() => onNavigate('calendar')}>
          {upcoming.length === 0 ? (
            <EmptyText>7일 내 일정이 없습니다.</EmptyText>
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
        </Panel>

        <Panel title="최근 노트" className="col-span-2" actionLabel="전체 보기" onAction={() => onNavigate('notes')}>
          {notes.notes.length === 0 ? (
            <EmptyText>작성한 노트가 없습니다.</EmptyText>
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
        </Panel>

        <Panel title="오늘 현황">
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
          <div className="pt-2 mt-3 border-t border-surface-border">
            <div className="flex justify-between text-xs text-gray-400">
              <span>전체 진행률</span>
              <span>{todos.todos.length > 0 ? `${Math.round((todos.completed.length / todos.todos.length) * 100)}%` : '0%'}</span>
            </div>
            <div className="mt-1 w-full h-2 bg-surface-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: todos.todos.length > 0 ? `${(todos.completed.length / todos.todos.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </Panel>
      </div>
        </div>

        <DashboardAiPanel
          messages={aiMessages}
          input={aiInput}
          loading={aiLoading}
          hasApiKey={!!settings.anthropicApiKey}
          bottomRef={aiBottomRef}
          onInput={setAiInput}
          onSend={() => sendAiQuestion()}
          onClear={() => setAiMessages([])}
          onNavigateSettings={() => onNavigate('settings')}
          onPrompt={sendAiQuestion}
        />
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

function DashboardAiPanel({
  messages,
  input,
  loading,
  hasApiKey,
  bottomRef,
  onInput,
  onSend,
  onClear,
  onNavigateSettings,
  onPrompt,
}: {
  messages: AIMessage[]
  input: string
  loading: boolean
  hasApiKey: boolean
  bottomRef: RefObject<HTMLDivElement>
  onInput: (value: string) => void
  onSend: () => void
  onClear: () => void
  onNavigateSettings: () => void
  onPrompt: (prompt: string) => void
}) {
  const suggestions = [
    '오늘 제일 먼저 처리할 일을 정리해줘',
    '내 일정과 할 일을 보고 리스크를 알려줘',
    '주식 정보까지 포함해서 오늘 브리핑해줘',
  ]

  return (
    <aside className="sticky top-6 h-[calc(100vh-3rem)] bg-surface border border-surface-border rounded-xl flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">AI 대화</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">현재 대시보드 정보를 보고 답변합니다.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-600 hover:text-gray-300">
            지우기
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {!hasApiKey ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <p className="text-sm text-gray-300">Anthropic API 키가 필요합니다.</p>
            <button onClick={onNavigateSettings} className="px-3 py-2 rounded-lg bg-accent text-white text-xs hover:bg-accent-hover">
              설정으로 이동
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 leading-relaxed">
              오른쪽에서 바로 질문하면 할 일, 일정, 노트, 주식 정보를 함께 참고해서 답변합니다.
            </p>
            <div className="space-y-2">
              {suggestions.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => onPrompt(prompt)}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-surface-card hover:bg-surface-hover text-xs text-gray-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[88%] rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : 'bg-surface-card text-gray-200 rounded-tl-sm'
              }`}>
                {message.content || (loading && index === messages.length - 1 ? '답변 작성 중...' : '')}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-surface-border">
        <textarea
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          disabled={!hasApiKey || loading}
          placeholder="질문을 입력하세요..."
          rows={3}
          className="w-full bg-surface-card rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50 resize-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={!hasApiKey || loading || !input.trim()}
          className="mt-2 w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? '답변 중...' : '질문 보내기'}
        </button>
      </div>
    </aside>
  )
}

function Panel({ title, children, className = '', actionLabel, onAction }: {
  title: string
  children: React.ReactNode
  className?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <section className={`bg-surface rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-xs text-gray-500 hover:text-accent">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-500 text-xs py-4 text-center leading-relaxed">{children}</p>
}
