import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ChatMarkdown from '@/components/ChatMarkdown'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePanelOrder, type PanelId, PANEL_LABELS } from '@/store/usePanelOrder'
import type { RefObject } from 'react'
import type { AIMessage, View, Settings, Todo } from '@/types'
import type { TodoState } from '@/store/useTodos'
import type { NoteState } from '@/store/useNotes'
import type { CalendarState } from '@/store/useCalendar'
import { fetchWeather, fetchWeatherFree, fetchWeatherForecast14Free, fetchWeatherFromMcp, fetchWeatherForecastFromMcp, weatherEmoji, type WeatherData, type WeatherForecast } from '@/services/weather'
import { getKoreanHoliday } from '@/utils/koreanCalendar'
import { fetchRssFeedsFromMcp, relativeRssDate, type RssItem } from '@/services/rss'
import { streamChat, briefingSystem, strategicSystem, buildBriefingMessage } from '@/services/claude'
import { streamChatOpenAI } from '@/services/openai'
import { streamClaudeWeb, claudeWebAutoConnect } from '@/services/claudeWeb'
import {
  displaySymbol,
  fetchWatchlist,
  fetchWatchlistFromMcp,
  fmtChange,
  fmtPrice,
  type StockQuote,
} from '@/services/stocks'
import { useBookmarks } from '@/store/useBookmarks'
import { useDailyLog, type DailyLogState } from '@/store/useDailyLog'
import { logActivity } from '@/services/activityLog'
import { useActivityLog } from '@/store/useActivityLog'

const OLLAMA_ENDPOINT = 'http://localhost:11434/v1'
const OLLAMA_MODEL = 'gemma4:e2b'

/** 원격 PDF가 frame-ancestors CSP로 iframe 임베드를 막는 경우를 대비해 로컬 MCP 서버를 통해 중계한다. */
function pdfProxyUrl(mcpEndpoint: string, url: string) {
  const base = mcpEndpoint.replace(/\/mcp\/?$/, '')
  return `${base}/pdf-proxy?url=${encodeURIComponent(url)}`
}

interface Props {
  todos: TodoState
  notes: NoteState
  calendar: CalendarState
  settings: Settings
  onNavigate: (v: View) => void
  onUpdateSettings?: (patch: Partial<Settings>) => void
}

interface PdfSummary {
  url: string
  title: string
  summary: string
  keyPoints: string[]
  textPreview: string
  charCount: number
  pageCount?: number | null
  pagesRead: number
  extractor: string
}

interface KgSearchResult {
  id: string
  title: string
  document: string
  source_type: string
  distance: number
}

const PRIORITY_COLOR = { high: 'text-red-500', medium: 'text-amber-500', low: 'text-blue-500' }
const PRIORITY_LABEL = { high: '높음', medium: '중간', low: '낮음' }

const SPLITS = ['1fr_1fr', '3fr_2fr', '2fr_1fr', 'full'] as const
type Split = typeof SPLITS[number]
const SPLIT_CLASS: Record<Split, string> = {
  '1fr_1fr': 'grid-cols-2',
  '3fr_2fr': 'grid-cols-[3fr_2fr]',
  '2fr_1fr': 'grid-cols-[2fr_1fr]',
  'full':    'grid-cols-1',
}
const SPLIT_LABEL: Record<Split, string> = { '1fr_1fr': '1:1', '3fr_2fr': '3:2', '2fr_1fr': '2:1', 'full': '전체' }

const STOCK_NAME_MAP: Record<string, string> = {
  // 한국 주요 종목
  '삼성전자': '005930.KS', '삼성': '005930.KS',
  'sk하이닉스': '000660.KS', '하이닉스': '000660.KS',
  '한미반도체': '042700.KS',
  '카카오': '035720.KS',
  '네이버': '035420.KS', 'naver': '035420.KS',
  '현대차': '005380.KS', '현대자동차': '005380.KS',
  '기아': '000270.KS', '기아차': '000270.KS',
  'lg전자': '066570.KS',
  '삼성sdi': '006400.KS',
  'lg화학': '051910.KS',
  '포스코': '005490.KS', 'posco': '005490.KS',
  '셀트리온': '068270.KS',
  'sk이노베이션': '096770.KS',
  'db하이텍': '000990.KS',
  '티씨케이': '091810.KS',
  // 인덱스
  '코스피': '^KS11', 'kospi': '^KS11',
  '코스닥': '^KQ11', 'kosdaq': '^KQ11',
  '나스닥': '^IXIC', 'nasdaq': '^IXIC',
  's&p': '^GSPC', 's&p500': '^GSPC', 'sp500': '^GSPC',
  '다우': '^DJI', '다우존스': '^DJI', 'dow': '^DJI',
  // 미국 주요 종목
  '애플': 'AAPL', 'apple': 'AAPL',
  '마이크로소프트': 'MSFT', 'microsoft': 'MSFT',
  '엔비디아': 'NVDA', 'nvidia': 'NVDA',
  '아마존': 'AMZN', 'amazon': 'AMZN',
  '구글': 'GOOGL', 'google': 'GOOGL', '알파벳': 'GOOGL',
  '메타': 'META', 'meta': 'META', '페이스북': 'META',
  '테슬라': 'TSLA', 'tesla': 'TSLA',
  '알리바바': 'BABA', 'alibaba': 'BABA',
  '넷플릭스': 'NFLX', 'netflix': 'NFLX',
  '인텔': 'INTC', 'intel': 'INTC',
  'amd': 'AMD',
  'tsmc': 'TSM',
  'asml': 'ASML',
  // 원자재 선물
  '금': 'GC=F', '금선물': 'GC=F', 'gold': 'GC=F',
  '은': 'SI=F', '은선물': 'SI=F', 'silver': 'SI=F',
  '원유': 'CL=F', '오일': 'CL=F', '유가': 'CL=F', 'oil': 'CL=F', 'crude': 'CL=F',
  '천연가스': 'NG=F', 'gas': 'NG=F',
  '구리': 'HG=F', 'copper': 'HG=F',
  // 암호화폐
  '비트코인': 'BTC-USD', 'bitcoin': 'BTC-USD', 'btc': 'BTC-USD',
  '이더리움': 'ETH-USD', 'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
  // 미국 주요 ETF
  '나스닥100': 'QQQ', 'qqq': 'QQQ',
  'spy': 'SPY', 's&p500etf': 'SPY',
  '아크': 'ARKK', 'arkk': 'ARKK', '아크이노베이션': 'ARKK',
  '금etf': 'GLD', 'gld': 'GLD',
  'dia': 'DIA', '다우etf': 'DIA',
  'iwm': 'IWM', '러셀': 'IWM',
  'vti': 'VTI',
  'voo': 'VOO',
  'schd': 'SCHD',
  'soxl': 'SOXL', '반도체레버리지': 'SOXL',
  'tqqq': 'TQQQ', '나스닥레버리지': 'TQQQ',
  // 한국 주요 ETF
  'kodex200': '069500.KS', '코덱스200': '069500.KS',
  '코덱스레버리지': '122630.KS',
  '코덱스인버스': '114800.KS',
  '코덱스코스닥150': '229200.KS',
}

function resolveStockSymbol(input: string): string {
  const key = input.trim().toLowerCase().replace(/\s+/g, '')
  // 공백 제거 후 매핑 시도
  if (STOCK_NAME_MAP[key]) return STOCK_NAME_MAP[key]
  // 공백 포함 원문으로 매핑 시도
  const keyWithSpace = input.trim().toLowerCase()
  if (STOCK_NAME_MAP[keyWithSpace]) return STOCK_NAME_MAP[keyWithSpace]
  // 매핑 없으면 대문자 심볼로 처리
  return input.trim().toUpperCase()
}

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

export default function Dashboard({ todos, notes, calendar, settings, onNavigate, onUpdateSettings }: Props) {
  const [weathers, setWeathers] = useState<WeatherData[]>([])
  const [forecast, setForecast] = useState<WeatherForecast[]>([])
  const [briefing, setBriefing] = useState(() => localStorage.getItem(`briefing-${new Date().toISOString().slice(0, 10)}`) || '')
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  type NewsItem = { title: string; url: string; points: number; comments: number; date: string; source: string; category?: string }
  const [aiNews, setAiNews] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState(false)
  const NEWS_CATS = ['전체', '논문', 'LLM', 'Business', 'GitHub/HuggingFace', '전반'] as const
  const [newsCat, setNewsCat] = useState<string>('전체')
  const [newsError, setNewsError] = useState('')
  const [rssItems, setRssItems] = useState<RssItem[]>([])
  const [rssLoading, setRssLoading] = useState(false)
  const [rssTab, setRssTab] = useState<string>('전체')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchEngine, setSearchEngine] = useState<string>(settings.searchEngine || 'google')

  async function fetchAiNews() {
    if (!settings.mcpEndpoint) return
    setLoadingNews(true)
    setNewsError('')
    try {
      const { callMcpTool } = await import('@/services/mcp')
      const result = await callMcpTool<NewsItem[]>(settings.mcpEndpoint, 'news.ai', { maxResults: 15 })
      setAiNews(Array.isArray(result) ? result : [])
    } catch (e: any) {
      setNewsError(e.message || '뉴스를 가져오지 못했습니다.')
    } finally {
      setLoadingNews(false)
    }
  }
  const SEARCH_ENGINES: Record<string, { label: string; url: string }> = {
    google:     { label: 'Google',     url: 'https://www.google.com/search?q=' },
    naver:      { label: 'Naver',      url: 'https://search.naver.com/search.naver?query=' },
    youtube:    { label: 'YouTube',    url: 'https://www.youtube.com/results?search_query=' },
    github:     { label: 'GitHub',     url: 'https://github.com/search?q=' },
    duckduckgo: { label: 'DDG',        url: 'https://duckduckgo.com/?q=' },
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const engine = SEARCH_ENGINES[searchEngine] ?? SEARCH_ENGINES.google
    window.open(engine.url + encodeURIComponent(searchQuery), '_blank', 'noopener,noreferrer')
    setSearchQuery('')
  }

  useEffect(() => {
    const urls = (settings.rssFeeds || '').split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length || !settings.mcpEndpoint) return
    setRssLoading(true)
    fetchRssFeedsFromMcp(settings.mcpEndpoint, urls)
      .then(setRssItems)
      .catch(() => {})
      .finally(() => setRssLoading(false))
  }, [settings.rssFeeds, settings.mcpEndpoint])

  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockSource, setStockSource] = useState<'api-key' | 'mcp' | null>(null)
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(() => {
    try {
      const raw = localStorage.getItem('dashboard-ai-chat')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return []
  })
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [shortcutUrl, setShortcutUrl] = useState('')
  const [shortcutError, setShortcutError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [activePdfUrl, setActivePdfUrl] = useState('')
  const [pdfSummary, setPdfSummary] = useState<PdfSummary | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [stockInput, setStockInput] = useState('')
  const [showStockInput, setShowStockInput] = useState(false)

  function handleAddStock(e: React.FormEvent) {
    e.preventDefault()
    const sym = resolveStockSymbol(stockInput)
    if (!sym) return
    const current = (settings.stockSymbols || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!current.includes(sym)) {
      onUpdateSettings?.({ stockSymbols: [...current, sym].join(', ') })
    }
    setStockInput('')
    setShowStockInput(false)
  }
  const [editMode, setEditMode] = useState(false)
  const { order, reorder } = usePanelOrder()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = order.indexOf(active.id as PanelId)
      const newIdx = order.indexOf(over.id as PanelId)
      reorder(arrayMove(order, oldIdx, newIdx))
    }
  }
  const [splitPct, setSplitPct] = useState<number>(() => Number(localStorage.getItem('dash-split-pct') || '50'))
  const [showAi, setShowAi] = useState<boolean>(() => localStorage.getItem('dash-show-ai') !== 'false')
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    function onMove(ev: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100))
      setSplitPct(pct)
      localStorage.setItem('dash-split-pct', String(pct))
    }
    function onUp() {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const { bookmarks, add: addBookmark, remove: removeBookmark, click: clickBookmark } = useBookmarks()
  const dailyLog = useDailyLog()

  const symbols = useMemo(() => parseSymbols(settings.stockSymbols || ''), [settings.stockSymbols])
  const routine = useMemo(
    () => (settings.dailyRoutine || '').split('\n').map(v => v.trim()).filter(Boolean),
    [settings.dailyRoutine],
  )
  const todayTodos = todos.pending.filter(t => isToday(t.dueDate)).slice(0, 5)
  const upcoming = calendar.upcoming(7)

  useEffect(() => {
    if (aiMessages.length === 0) return
    const el = aiBottomRef.current
    const scroller = el?.parentElement
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [aiMessages])

  useEffect(() => {
    localStorage.setItem('dashboard-ai-chat', JSON.stringify(aiMessages))
  }, [aiMessages])

  useEffect(() => {
    const cities = (settings.weatherCities || settings.city || '화성')
      .split(',').map(s => s.trim()).filter(Boolean)
    if (!cities.length) return

    async function fetchOne(city: string): Promise<WeatherData | null> {
      if (settings.dataAccessMode === 'mcp' && settings.mcpEndpoint) {
        try { return await fetchWeatherFromMcp(settings.mcpEndpoint, city) } catch {}
      }
      if (settings.weatherApiKey) {
        try { return await fetchWeather(city, settings.weatherApiKey) } catch {}
      }
      // API Key 없어도 wttr.in으로 무료 조회
      try { return await fetchWeatherFree(city) } catch {}
      return null
    }

    Promise.all(cities.map(fetchOne)).then(results => {
      setWeathers(results.filter((w): w is WeatherData => w !== null))
    })

    // 첫 번째 도시 기준 예보 (MCP → wttr.in 무료 순으로 시도)
    if (settings.dataAccessMode === 'mcp' && settings.mcpEndpoint) {
      fetchWeatherForecastFromMcp(settings.mcpEndpoint, cities[0])
        .then(setForecast)
        .catch(() => fetchWeatherForecast14Free(cities[0]).then(setForecast).catch(() => {}))
    } else {
      fetchWeatherForecast14Free(cities[0]).then(setForecast).catch(() => {})
    }
  }, [settings.mcpEndpoint, settings.weatherApiKey, settings.weatherCities, settings.city])

  useEffect(() => {
    if (!symbols.length) return

    async function autoLoad() {
      setStocksLoading(true)
      setStockError('')

      // MCP 서버 먼저 시도 (stock_mcp_server.py)
      if (settings.mcpEndpoint) {
        setStockSource('mcp')
        try {
          const data = await fetchWatchlistFromMcp(settings.mcpEndpoint, symbols)
          if (data.length) {
            setStocks(data)
            setStocksLoading(false)
            logActivity('stock', '주가 확인')
            return
          }
        } catch {}
      }

      // MCP 실패 시 Finnhub API Key로 fallback
      if (settings.finnhubApiKey) {
        setStockSource('api-key')
        try {
          const data = await fetchWatchlist(symbols, settings.finnhubApiKey)
          setStocks(data)
          if (!data.length) setStockError('가져온 주식 정보가 없습니다.')
          else logActivity('stock', '주가 확인')
        } catch (err) {
          setStockError(err instanceof Error ? err.message : '주식 정보를 가져오지 못했습니다.')
        }
      } else {
        setStockError('stock_mcp_server.py를 실행하거나 설정에서 Finnhub API 키를 입력하세요.')
      }

      setStocksLoading(false)
    }

    autoLoad()
  }, [settings.finnhubApiKey, settings.mcpEndpoint, settings.stockSymbols])

  const aiProvider = settings.aiProvider ?? 'ollama'
  const hasAiKey = aiProvider === 'ollama' || !!(settings.anthropicApiKey || settings.claudeSessionKey || settings.openaiApiKey || settings.customAiEndpoint)

  async function callDashboardStream(
    msgs: Array<{ role: 'user' | 'assistant'; content: string }>,
    system: string,
    onDelta: (t: string) => void,
  ) {
    if (aiProvider === 'ollama') {
      return streamChatOpenAI('', OLLAMA_ENDPOINT, OLLAMA_MODEL, msgs, system, onDelta)
    } else if (aiProvider === 'claude-web') {
      return callClaudeWebWithRetry(settings.claudeSessionKey, msgs, system, onDelta)
    } else if (aiProvider === 'chatgpt') {
      return streamChatOpenAI(settings.openaiApiKey, 'https://api.openai.com/v1', 'gpt-4o', msgs, system, onDelta)
    } else if (aiProvider === 'custom') {
      return streamChatOpenAI('', settings.customAiEndpoint, settings.customAiModel || 'gpt-4o', msgs, system, onDelta)
    }
    return streamChat(settings.anthropicApiKey, msgs, system, onDelta)
  }

  // Claude.ai 웹 세션: 403(세션 만료) 시 자동 재연결, 429(한도 초과) 시 백오프 후 재시도
  async function callClaudeWebWithRetry(
    sessionKey: string,
    msgs: Array<{ role: 'user' | 'assistant'; content: string }>,
    system: string,
    onDelta: (t: string) => void,
  ) {
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
    let key = sessionKey
    let reconnected = false
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await streamClaudeWeb(key, settings.mcpEndpoint, msgs, system, onDelta)
      } catch (e: any) {
        const errMsg = e?.error?.message || e?.message || String(e)
        const is403 = errMsg.includes('403') || /세션 만료|session/i.test(errMsg)
        const is429 = errMsg.includes('429') || /한도 초과|rate limit|too many/i.test(errMsg)

        if (is403 && !reconnected) {
          // 세션 키 자동 재발급 (MCP가 Chrome 로그인 상태에서 추출)
          const fresh = await claudeWebAutoConnect(settings.mcpEndpoint)
          if (fresh && fresh !== key) {
            key = fresh
            reconnected = true
            onUpdateSettings?.({ claudeSessionKey: fresh })
            continue // 새 키로 즉시 재시도
          }
          throw new Error('세션 만료(403). 설정에서 Claude.ai를 다시 연결해주세요.')
        }

        if (is429 && attempt < 3) {
          await wait(2000 * (attempt + 1)) // 2s, 4s, 6s 백오프
          continue
        }
        throw e
      }
    }
    throw new Error('Claude.ai 연결에 반복 실패했습니다. 잠시 후 다시 시도하거나 설정에서 재연결해주세요.')
  }

  async function generateBriefing() {
    if (!hasAiKey) { onNavigate('settings'); return }
    setLoadingBriefing(true)
    setBriefing('')
    const msg = buildBriefingMessage({
      pending: todos.pending.map(t => t.text),
      highPriority: todos.highPriority.map(t => t.text),
      completedToday: todos.completedToday.map(t => t.text),
      upcomingEvents: upcoming.map(e => `${e.date} ${e.title}`),
      recentNotes: notes.notes.slice(0, 3).map(n => n.title),
      rssNews: rssItems.slice(0, 8).map(it => `[${it.source}] ${it.title}`),
      aiNews: aiNews.slice(0, 5).map(n => n.title),
    })
    try {
      let result = ''
      await callDashboardStream([{ role: 'user', content: msg }], briefingSystem(settings.userName), (delta) => {
        result += delta
        setBriefing(result)
      })
      localStorage.setItem(`briefing-${new Date().toISOString().slice(0, 10)}`, result)
      logActivity('briefing', 'AI 브리핑 생성')
    } catch (e: any) {
      const errMsg = e?.error?.message || e?.message || String(e)
      setBriefing(`오류: ${errMsg}`)
    } finally {
      setLoadingBriefing(false)
    }
  }

  function pdfContextBlock(summary: PdfSummary): string {
    return [
      `문서명: ${summary.title}`,
      `URL: ${summary.url}`,
      `핵심 문장:\n${summary.keyPoints.map(p => `- ${p}`).join('\n')}`,
      `본문 미리보기:\n${summary.textPreview}`,
    ].join('\n')
  }

  function kgContextBlock(results: KgSearchResult[]): string {
    return results.map((r, i) => {
      const snippet = r.document.length > 400 ? r.document.slice(0, 400) + '…' : r.document
      return `[${i + 1}] ${r.title} (${r.source_type})\n${snippet}`
    }).join('\n\n')
  }

  async function searchKnowledgeGraph(query: string): Promise<string> {
    if (!settings.mcpEndpoint || !query.trim()) return ''
    try {
      const { callMcpTool } = await import('@/services/mcp')
      const result = await callMcpTool<{ results: KgSearchResult[] }>(
        settings.mcpEndpoint,
        'kg.search',
        { q: query, limit: 5 },
        undefined,
        10000,
      )
      const results = result?.results ?? []
      if (results.length === 0) return ''
      return `[내 지식 그래프 검색 결과 - 질문과 관련된 자료입니다. 답변 시 적극 참고하고, 관련 있으면 출처(제목)를 함께 언급하세요]\n${kgContextBlock(results)}`
    } catch {
      return ''
    }
  }

  // AI 대화 내용을 날짜별 노트("AI 대화 기록 - YYYY-MM-DD")에 자동으로 누적 기록한다.
  function appendAiExchangeToNotes(question: string, answer: string) {
    if (!question.trim() || !answer.trim()) return
    const dateKey = new Date().toISOString().slice(0, 10)
    const title = `AI 대화 기록 - ${dateKey}`
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const entry = `### ${time}\nQ: ${question}\n\nA: ${answer}`
    const existing = notes.notes.find(n => n.title === title)
    if (existing) {
      notes.update(existing.id, { content: `${existing.content}\n\n---\n\n${entry}` })
    } else {
      const id = notes.create(title)
      notes.update(id, { content: entry })
    }
  }

  function buildAiContext(): string {
    const pending = todos.pending.map(t => `[${t.priority}] ${t.text}`).join('\n')
    const completed = todos.completedToday.map(t => t.text).join(', ')
    const events = upcoming.map(e => `${e.date} ${e.time || ''} ${e.title}`.trim()).join('\n')
    const recentNotes = notes.notes.slice(0, 10).map((n, i) => {
      const body = n.content.length > 2000 ? n.content.slice(0, 2000) + '…(이하 생략)' : n.content
      return `[노트 ${i + 1}] 제목: ${n.title || '(제목 없음)'}\n${body || '(내용 없음)'}`
    }).join('\n\n')
    const stockSummary = stocks.map(q => `${q.symbol}: ${fmtPrice(q)} ${fmtChange(q)}`).join('\n')
    const routineSummary = routine.map(item => `- ${item}`).join('\n')

    const rssSummary = rssItems.slice(0, 8).map(it => `- [${it.source}] ${it.title}`).join('\n')
    const aiNewsSummary = aiNews.slice(0, 5).map(n => `- ${n.title}`).join('\n')
    const pdfContext = pdfSummary ? pdfContextBlock(pdfSummary) : ''

    return [
      `[현재 대시보드 상황]`,
      `매일 하는 일:\n${routineSummary || '없음'}`,
      `미완료 할 일:\n${pending || '없음'}`,
      `오늘 완료: ${completed || '없음'}`,
      `다가오는 일정:\n${events || '없음'}`,
      `최근 노트:\n${recentNotes || '없음'}`,
      `주식 정보:\n${stockSummary || '아직 불러오지 않음'}`,
      rssSummary ? `오늘 뉴스 (RSS):\n${rssSummary}` : '',
      aiNewsSummary ? `AI 기술 동향:\n${aiNewsSummary}` : '',
    ].filter(Boolean).join('\n\n') + (pdfContext ? `\n\nCurrent PDF document:\n${pdfContext}` : '')
  }

  async function sendAiQuestion(question?: string) {
    const raw = (question ?? aiInput).trim()
    if (!raw || aiLoading) return
    if (!hasAiKey) { onNavigate('settings'); return }

    const isBriefingRequest = /브리핑|briefing|오늘\s*요약|뉴스\s*요약/.test(raw)
    const content = isBriefingRequest
      ? buildBriefingMessage({
          pending: todos.pending.map(t => t.text),
          highPriority: todos.highPriority.map(t => t.text),
          completedToday: todos.completedToday.map(t => t.text),
          upcomingEvents: upcoming.map(e => `${e.date} ${e.title}`),
          recentNotes: notes.notes.slice(0, 3).map(n => n.title),
          rssNews: rssItems.slice(0, 8).map(it => `[${it.source}] ${it.title}`),
          aiNews: aiNews.slice(0, 5).map(n => n.title),
        })
      : raw

    setAiInput('')
    setAiLoading(true)
    logActivity('ai-chat', isBriefingRequest ? 'AI 브리핑 (채팅)' : 'AI 어시스턴트 대화')

    const userMessage: AIMessage = { role: 'user', content: raw, timestamp: new Date().toISOString() }
    const assistantMessage: AIMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    const nextMessages = [...aiMessages, userMessage, assistantMessage]
    setAiMessages(nextMessages)

    const answerIndex = nextMessages.length - 1
    const history = nextMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    let fullAnswer = ''
    try {
      const kgContext = isBriefingRequest ? '' : await searchKnowledgeGraph(raw)
      await callDashboardStream(
        history as Array<{ role: 'user' | 'assistant'; content: string }>,
        `${strategicSystem(settings.userName)}\n\n${buildAiContext()}${kgContext ? `\n\n${kgContext}` : ''}`,
        (delta) => {
          fullAnswer += delta
          setAiMessages(p => p.map((m, i) => i === answerIndex ? { ...m, content: m.content + delta } : m))
        },
      )
      appendAiExchangeToNotes(raw, fullAnswer)
    } catch (e: any) {
      const errMsg = e?.error?.message || e?.message || String(e)
      setAiMessages(p => p.map((m, i) =>
        i === answerIndex ? { ...m, content: `오류: ${errMsg}` } : m
      ))
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
      else logActivity('stock', '주가 확인')
    } catch (err) {
      setStockError(err instanceof Error ? err.message : '주식 정보를 가져오지 못했습니다.')
    } finally {
      setStocksLoading(false)
    }
  }

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = pdfUrl.trim()
    if (!url) return
    if (!settings.mcpEndpoint) {
      setPdfError('MCP 엔드포인트가 필요합니다.')
      onNavigate('settings')
      return
    }
    const isPdf = /\.pdf(\?|#|$)/i.test(url)
    const tool = isPdf ? 'pdf.summarize' : 'web.summarize'
    const toolArgs = isPdf
      ? { url, maxPages: 12, summarySentences: 5 }
      : { url, summarySentences: 5 }

    setActivePdfUrl(isPdf ? url : '')
    setPdfLoading(true)
    setPdfError('')
    setPdfSummary(null)
    try {
      const { callMcpTool } = await import('@/services/mcp')
      const result = await callMcpTool<PdfSummary>(
        settings.mcpEndpoint,
        tool,
        toolArgs,
        undefined,
        30000,
      )
      setPdfSummary(result)
      logActivity('pdf', `요약: ${result.title || url}`)
      if (hasAiKey) {
        const kind = isPdf ? 'PDF 문서' : '웹페이지'
        const userMessage: AIMessage = {
          role: 'user',
          content: `${kind}를 읽었습니다: ${result.title}\n이 내용을 한국어로 자연스럽게 요약하고 핵심 포인트를 알려줘.`,
          timestamp: new Date().toISOString(),
        }
        const assistantMessage: AIMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
        const nextMessages = [...aiMessages, userMessage, assistantMessage]
        setAiMessages(nextMessages)
        const answerIndex = nextMessages.length - 1

        setAiLoading(true)
        let fullAnswer = ''
        try {
          await callDashboardStream(
            [{ role: 'user', content: `다음 ${kind}을 한국어로 자연스럽게 요약하고, 핵심 포인트를 정리해줘.\n\n${pdfContextBlock(result)}` }],
            strategicSystem(settings.userName),
            (delta) => {
              fullAnswer += delta
              setAiMessages(p => p.map((m, i) => i === answerIndex ? { ...m, content: m.content + delta } : m))
            },
          )
          appendAiExchangeToNotes(`${kind} 요약: ${result.title}`, fullAnswer)
        } catch (e: any) {
          const errMsg = e?.error?.message || e?.message || String(e)
          setAiMessages(p => p.map((m, i) => i === answerIndex ? { ...m, content: `오류: ${errMsg}` } : m))
        } finally {
          setAiLoading(false)
        }
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : '내용을 요약하지 못했습니다.')
    } finally {
      setPdfLoading(false)
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 p-6 pb-0 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">안녕하세요, {settings.userName}님</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex gap-2 text-sm items-center">
          <button
            onClick={async () => {
              try {
                await fetch('http://127.0.0.1:8765/restart', { method: 'POST' })
              } catch {}
            }}
            title="MCP · Vite 서버 재시작"
            className="px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors text-xs"
          >
            ↺ 서버 재시작
          </button>
          <button onClick={() => onNavigate('todos')} className="px-3 py-1.5 bg-surface border border-surface-border rounded-lg text-gray-700 hover:bg-surface-hover transition-colors">
            할 일 관리
          </button>
          <button onClick={() => onNavigate('settings')} className="px-3 py-1.5 bg-surface border border-surface-border rounded-lg text-gray-700 hover:bg-surface-hover transition-colors">
            연결 설정
          </button>
          <button onClick={() => onNavigate('ai')} className="px-3 py-1.5 bg-gray-900 rounded-lg text-white hover:bg-gray-700 transition-colors">
            AI 브리핑
          </button>
          <button
            onClick={() => { setShowAi(v => { localStorage.setItem('dash-show-ai', String(!v)); return !v }) }}
            title="AI 패널 토글"
            className="px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-gray-500 hover:bg-surface-hover transition-colors text-xs"
          >
            {showAi ? 'AI 숨기기' : 'AI 보기'}
          </button>
          <button
            onClick={() => setEditMode(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${editMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-surface border-surface-border text-gray-500 hover:bg-surface-hover'}`}
          >
            {editMode ? '완료' : '배치 편집'}
          </button>
        </div>
      </div>

      {/* 검색 바 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex bg-white border border-surface-border rounded-xl overflow-hidden flex-1 shadow-sm">
          <select
            value={searchEngine}
            onChange={e => setSearchEngine(e.target.value)}
            className="text-xs text-gray-500 bg-gray-50 border-r border-surface-border px-3 outline-none"
          >
            {Object.entries(SEARCH_ENGINES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="검색어를 입력하세요..."
            className="flex-1 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>
        <button type="submit" className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-xl transition-colors">
          검색
        </button>
      </form>

      </div>{/* end header */}
      <div ref={containerRef} className="flex-1 min-h-0 flex gap-0 items-stretch px-6 pb-6 pt-5" style={{ userSelect: isDragging.current ? 'none' : 'auto' }}>
        <div className="space-y-5 min-w-0 overflow-y-auto pr-1" style={{ width: showAi ? `${splitPct}%` : '100%' }}>
      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: '1fr 1fr 1fr 3fr' }}>
        {/* 남은 할 일 */}
        <div onClick={() => onNavigate('todos')} className="bg-surface border border-surface-border rounded-xl p-3 cursor-pointer hover:bg-surface-hover transition-colors">
          <p className="text-[10px] text-gray-500">남은 할 일</p>
          <p className="text-2xl font-bold text-blue-500">{todos.pending.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">완료 {todos.completedToday.length}개</p>
        </div>
        {/* 높은 우선순위 */}
        <div onClick={() => onNavigate('todos')} className="bg-surface border border-surface-border rounded-xl p-3 cursor-pointer hover:bg-surface-hover transition-colors">
          <p className="text-[10px] text-gray-500">높은 우선순위</p>
          <p className="text-2xl font-bold text-red-500">{todos.highPriority.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{todos.highPriority.length > 0 ? '먼저 확인' : '없음'}</p>
        </div>
        {/* 오늘 현황 */}
        <div className="bg-surface border border-surface-border rounded-xl p-3">
          <p className="text-[10px] text-gray-500 mb-1.5">오늘 현황</p>
          <div className="space-y-1">
            {(['high', 'medium', 'low'] as const).map(p => {
              const count = todos.pending.filter(t => t.priority === p).length
              return (
                <div key={p} className="flex items-center gap-1.5">
                  <span className={`text-[10px] w-5 shrink-0 ${PRIORITY_COLOR[p]}`}>{PRIORITY_LABEL[p]}</span>
                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: todos.pending.length ? `${(count / todos.pending.length) * 100}%` : '0%', background: p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#3b82f6' }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-3 text-right">{count}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-right">{todos.todos.length > 0 ? `${Math.round((todos.completed.length / todos.todos.length) * 100)}%` : '0%'}</p>
        </div>
        {/* 매일 하는 일 — 전체 패널 */}
        <DailyRoutinePanel
          routine={routine}
          todayTodos={todayTodos}
          dailyLog={dailyLog}
          onToggleTodo={todos.toggle}
          onNavigate={onNavigate}
          upcoming={[]}
        />
      </div>

      {/* 다가오는 일정 — 5열 행 바로 아래 */}
      <div className="bg-white border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">다가오는 일정</h2>
          <button onClick={() => onNavigate('calendar')} className="text-xs text-gray-400 hover:text-gray-700">캘린더</button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-400">7일 내 일정이 없습니다.</p>
        ) : (
          <ul className="flex gap-4 overflow-x-auto">
            {upcoming.slice(0, 5).map(e => (
              <li key={e.id} className="flex items-center gap-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                <div>
                  <p className="text-xs text-gray-800 line-clamp-1">{e.title}</p>
                  <p className="text-[10px] text-gray-400">{e.date}{e.time ? ` ${e.time}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel title="PDF / 웹 요약">
        <form onSubmit={handlePdfSubmit} className="flex gap-2">
          <input
            value={pdfUrl}
            onChange={e => {
              setPdfUrl(e.target.value)
              if (pdfError) setPdfError('')
            }}
            placeholder="PDF 또는 웹 URL 입력: https://example.com/file.pdf"
            className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            type="submit"
            disabled={!pdfUrl.trim() || pdfLoading}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
          >
            {pdfLoading ? '요약 중...' : '요약'}
          </button>
        </form>
        {pdfError && <p className="text-xs text-red-500">{pdfError}</p>}
        {pdfLoading && <p className="text-xs text-gray-400">MCP가 내용을 읽는 중입니다... (완료되면 AI 대화에 표시됩니다)</p>}
        {activePdfUrl && (
          <div className="h-80 overflow-hidden rounded-lg border border-surface-border bg-gray-50">
            <iframe src={pdfProxyUrl(settings.mcpEndpoint, activePdfUrl)} title="PDF preview" className="h-full w-full border-0" />
          </div>
        )}
        {pdfSummary && (
          <button
            onClick={() => sendAiQuestion('방금 읽은 내용을 쉽게 요약하고, 내가 바로 실행할 수 있는 다음 행동 3가지를 알려줘')}
            className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] hover:bg-gray-700"
          >
            AI 해석
          </button>
        )}
      </Panel>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
      {order.map(panelId => {
        if (panelId === 'weather') return (
        <SortablePanelWrapper key="weather" id="weather" label="날씨" editMode={editMode}>
      {/* 날씨 2주 예보 — 일요일 시작, 토요일 끝 */}
      {forecast.length > 0 ? (
        (() => {
          const todayDate = new Date(); todayDate.setHours(0,0,0,0)
          const todayMs = todayDate.getTime()
          const DAY = ['일','월','화','수','목','금','토']
          // 이번 주 일요일
          const thisSunday = new Date(todayDate)
          thisSunday.setDate(todayDate.getDate() - todayDate.getDay())
          const fcMap = new Map(forecast.map(f => [f.date, f]))

          const renderCell = (offset: number) => {
            const d = new Date(thisSunday); d.setDate(thisSunday.getDate() + offset)
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            const isPast = d.getTime() < todayMs
            const isToday = d.getTime() === todayMs
            const isSun = d.getDay() === 0
            const isSat = d.getDay() === 6
            const holiday = getKoreanHoliday(dateStr)
            const isRed = (isSun || !!holiday) && !isToday
            const fc = fcMap.get(dateStr)
            return (
              <div key={dateStr} className={`flex flex-col items-center gap-0 px-0.5 py-1.5 rounded
                ${isToday ? 'bg-gray-900 text-white' : isPast ? 'opacity-30 text-gray-400' : isRed ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                <span className="text-[10px] font-medium leading-tight">{DAY[d.getDay()]}</span>
                <span className={`text-[9px] leading-tight ${isToday ? 'text-gray-300' : 'text-gray-400'}`}>{d.getMonth()+1}/{d.getDate()}</span>
                {fc ? (
                  <>
                    <span className="text-sm leading-snug">{weatherEmoji(fc.icon)}</span>
                    <span className="text-[10px] font-semibold tabular-nums leading-tight">{fc.maxTemp}°</span>
                    <span className={`text-[9px] tabular-nums leading-tight ${isToday ? 'text-gray-300' : 'text-gray-400'}`}>{fc.minTemp}°</span>
                  </>
                ) : <span className="text-xs leading-snug opacity-0">-</span>}
              </div>
            )
          }

          return (
            <div className="bg-surface border border-surface-border rounded-xl p-2 space-y-1">
              <div className="grid grid-cols-7 gap-0.5">{Array.from({length:7},(_,i)=>renderCell(i))}</div>
              <div className="border-t border-surface-border pt-1 grid grid-cols-7 gap-0.5">{Array.from({length:7},(_,i)=>renderCell(i+7))}</div>
            </div>
          )
        })()
      ) : (
        <div
          onClick={() => onNavigate('settings')}
          className="bg-surface border border-surface-border rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors flex items-center gap-3 text-gray-400"
        >
          <span className="text-2xl">🌤️</span>
          <div>
            <p className="text-sm font-medium">날씨 설정 필요</p>
            <p className="text-xs mt-0.5">설정 → 날씨 도시에 도시명을 입력하고 MCP 서버를 실행하세요.</p>
          </div>
        </div>
      )}
      </SortablePanelWrapper>
        )
        if (panelId === 'shortcuts') return (
        <SortablePanelWrapper key="shortcuts" id="shortcuts" label="바로가기" editMode={editMode}>
      <Panel title="빠른 바로가기" className="!space-y-3">
        <form onSubmit={handleAddShortcut} className="flex gap-2">
          <input
            value={shortcutUrl}
            onChange={e => {
              setShortcutUrl(e.target.value)
              if (shortcutError) setShortcutError('')
            }}
            placeholder="바로가기 URL 추가: youtube.com, docs.google.com ..."
            className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            type="submit"
            disabled={!shortcutUrl.trim()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
          >
            추가
          </button>
        </form>
        {shortcutError && <p className="text-xs text-red-500">{shortcutError}</p>}
        <div className="flex flex-wrap gap-1.5">
          {bookmarks.map(link => (
            <div
              key={link.id}
              className="group relative rounded-lg bg-surface border border-surface-border text-xs text-gray-700 hover:bg-surface-hover hover:text-gray-900 transition-colors"
            >
              <button
                onClick={() => { clickBookmark(link.id); openExternalUrl(link.url) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5"
                title={link.title}
              >
                <img
                  src={link.favicon}
                  alt=""
                  className="h-4 w-4 rounded shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="truncate max-w-[80px]">{link.title}</span>
              </button>
              <button
                onClick={() => removeBookmark(link.id)}
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[10px] text-gray-600 hover:text-red-500 group-hover:flex"
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Panel>
      </SortablePanelWrapper>
        )
        if (panelId === 'stocks') return (
        <SortablePanelWrapper key="stocks" id="stocks" label="주식" editMode={editMode}>
      {/* 주식 패널 — 3열 그리드 */}
      <div className="bg-white border border-surface-border rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">주식</span>
          <span className="text-[11px] text-gray-400">
            {stocks.length > 0 && symbols.length > 0 && stocks.length < symbols.length
              ? `${stocks.length}/${symbols.length} 로드됨`
              : stocks.length > 0 ? `${stocks.length}개` : ''}
          </span>
          {stockError && <span className="text-[11px] text-red-500">{stockError}</span>}
          <div className="flex gap-1 ml-auto items-center">
            {showStockInput ? (
              <form onSubmit={handleAddStock} className="flex gap-1 items-center">
                <input
                  type="text"
                  value={stockInput}
                  onChange={e => setStockInput(e.target.value)}
                  placeholder="삼성전자, 테슬라, AAPL"
                  autoFocus
                  className="w-28 px-2 py-0.5 text-[11px] border border-gray-300 rounded outline-none focus:ring-1 focus:ring-gray-400"
                />
                <button type="submit" className="px-2 py-0.5 rounded bg-gray-900 text-white text-[11px] hover:bg-gray-700">추가</button>
                <button type="button" onClick={() => setShowStockInput(false)} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px]">✕</button>
              </form>
            ) : (
              <button onClick={() => setShowStockInput(true)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px] hover:bg-gray-200" title="종목 추가">+</button>
            )}
            <button onClick={loadStocksViaMcp} disabled={stocksLoading}
              className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px] hover:bg-gray-200 disabled:opacity-40">
              {stocksLoading ? '...' : 'MCP'}
            </button>
            <button onClick={loadStocksViaApiKey} disabled={stocksLoading}
              className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px] hover:bg-gray-200 disabled:opacity-40">
              API
            </button>
          </div>
        </div>
        {stocks.length > 0 ? (
          <div className="overflow-y-auto" style={{ maxHeight: '234px' }}>
            <div className="grid grid-cols-4 gap-1.5">
            {stocks.map(q => (
              <div key={q.symbol} className="bg-surface border border-surface-border rounded-lg px-2 py-2 min-w-0">
                <div className="text-[11px] font-semibold text-gray-700 truncate leading-tight">{displaySymbol(q)}</div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">{fmtPrice(q)}</div>
                <div className={`text-[10px] mt-0.5 ${q.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtChange(q)}</div>
              </div>
            ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">{stocksLoading ? '불러오는 중...' : 'MCP 또는 API 버튼으로 시세를 가져오세요.'}</p>
        )}
      </div>
      </SortablePanelWrapper>
        )
        if (panelId === 'rss') return (
        <SortablePanelWrapper key="rss" id="rss" label="RSS 피드" editMode={editMode}>
          <div className="space-y-4">
            <PdfMcpPanel
              pdfUrl={pdfUrl}
              activePdfUrl={activePdfUrl}
              mcpEndpoint={settings.mcpEndpoint}
              summary={pdfSummary}
              loading={pdfLoading}
              error={pdfError}
              onUrlChange={value => {
                setPdfUrl(value)
                if (pdfError) setPdfError('')
              }}
              onSubmit={handlePdfSubmit}
              onAskAi={() => sendAiQuestion('방금 읽은 내용을 쉽게 요약하고, 내가 바로 실행할 수 있는 다음 행동 3가지를 알려줘')}
            />
            <Panel title="최근 노트" actionLabel="전체 보기" onAction={() => onNavigate('notes')}>
              {notes.notes.length === 0 ? (
                <p className="text-xs text-gray-400">작성한 노트가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {notes.notes.slice(0, 4).map(n => (
                    <button
                      key={n.id}
                      onClick={() => onNavigate('notes')}
                      title={n.title || '(제목 없음)'}
                      className="aspect-square flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow-sm bg-white transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-sm shrink-0 font-medium text-gray-600">
                        {n.title ? n.title[0].toUpperCase() : '📝'}
                      </div>
                      <p className="text-[10px] font-medium text-gray-800 text-center line-clamp-2 leading-tight w-full">{n.title || '(제목 없음)'}</p>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          {(() => {
            const rssSources = ['전체', ...Array.from(new Set(rssItems.map(it => it.source))).filter(Boolean)]
            const rssFiltered = rssTab === '전체' ? rssItems : rssItems.filter(it => it.source === rssTab)
            return (
              <Panel
                title="RSS 피드"
                actionLabel={rssLoading ? '...' : '새로고침'}
                onAction={() => {
                  const urls = (settings.rssFeeds || '').split('\n').map(u => u.trim()).filter(Boolean)
                  if (!urls.length || !settings.mcpEndpoint) return
                  setRssLoading(true)
                  fetchRssFeedsFromMcp(settings.mcpEndpoint, urls).then(setRssItems).catch(() => {}).finally(() => setRssLoading(false))
                }}
              >
                {rssItems.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap -mt-7 mb-2">
                    {rssSources.map(src => (
                      <button key={src} onClick={() => setRssTab(src)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          rssTab === src ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {src}
                        {src === '전체'
                          ? <span className="ml-1 opacity-60">{rssItems.length}</span>
                          : <span className="ml-1 opacity-60">{rssItems.filter(it => it.source === src).length}</span>
                        }
                      </button>
                    ))}
                  </div>
                )}
                {rssFiltered.length === 0 && !rssLoading ? (
                  <p className="text-xs text-gray-400 text-center py-2 cursor-pointer hover:text-gray-600" onClick={() => onNavigate('settings')}>
                    설정 → RSS 피드 URL을 추가하세요.
                  </p>
                ) : (
                  <ul className="space-y-0.5 overflow-y-auto" style={{ maxHeight: '150px' }}>
                    {rssFiltered.map((item, i) => (
                      <li key={i}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-2 px-1 py-1.5 rounded-lg hover:bg-surface group">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-800 font-medium line-clamp-1 group-hover:text-blue-600">{item.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{item.source} · {relativeRssDate(item.date)}</p>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })()}
          </div>
        </SortablePanelWrapper>
        )
        if (panelId === 'grid') return (
        <SortablePanelWrapper key="grid" id="grid" label="할 일/브리핑/일정/노트" editMode={editMode}>
      <div className="grid grid-cols-1 gap-4 items-stretch">
        <Panel title="AI 뉴스">
          {/* 헤더: 탭 + 새로고침 */}
          <div className="flex items-center gap-1 -mt-8 mb-3 flex-wrap">
            <div className="flex gap-0.5 flex-1 flex-wrap">
              {NEWS_CATS.map(cat => (
                <button key={cat} onClick={() => setNewsCat(cat)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    newsCat === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {cat}
                  {cat !== '전체' && aiNews.length > 0 && (
                    <span className="ml-1 opacity-60">{aiNews.filter(n => n.category === cat).length}</span>
                  )}
                  {cat === '전체' && aiNews.length > 0 && (
                    <span className="ml-1 opacity-60">{aiNews.length}</span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={fetchAiNews} disabled={loadingNews}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 shrink-0">
              {loadingNews ? '...' : '새로고침'}
            </button>
          </div>
          {newsError && <p className="text-xs text-red-500 mb-2">{newsError}</p>}
          {aiNews.length > 0 ? (
            <ul className="space-y-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
              {aiNews
                .filter(n => newsCat === '전체' || n.category === newsCat)
                .map((n, i) => (
                <li key={i}>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { logActivity('ai', `AI 뉴스 읽음: ${n.title}`); openExternalUrl(n.url) }}
                    className="flex items-start gap-2 group hover:bg-surface-hover rounded-lg px-1.5 py-1.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">{n.category || '전반'}</span>
                        <span className="text-[10px] text-gray-300 shrink-0">{n.source}</span>
                      </div>
                      <p className="text-xs text-gray-800 group-hover:text-blue-600 leading-snug line-clamp-2">{n.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">▲{n.points} · 💬{n.comments} · {n.date}</p>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-400 text-xs shrink-0 mt-1">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-4">
              <EmptyText>새로고침 버튼으로 AI 최신 뉴스를 가져오세요.</EmptyText>
              <p className="text-[10px] text-gray-400 mt-1">Reddit ML·LLM · HuggingFace Papers · 트렌딩 모델</p>
            </div>
          )}
        </Panel>

      </div>
      </SortablePanelWrapper>
        )
        return null
      })}
      </SortableContext>
      </DndContext>
        </div>

        {showAi && (
          <>
            {/* 드래그 구분선 */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-1.5 shrink-0 self-stretch cursor-col-resize flex items-center justify-center group hover:bg-gray-200 transition-colors mx-1"
              title="드래그하여 크기 조절"
            >
              <div className="w-0.5 h-12 bg-gray-200 group-hover:bg-gray-400 rounded-full transition-colors" />
            </div>
            <div className="min-w-0 flex flex-col" style={{ width: `${100 - splitPct}%` }}>
              <DashboardAiPanel
                messages={aiMessages}
                input={aiInput}
                loading={aiLoading}
                hasApiKey={hasAiKey}
                bottomRef={aiBottomRef}
                onInput={setAiInput}
                onSend={() => sendAiQuestion()}
                onClear={() => setAiMessages([])}
                onNavigateSettings={() => onNavigate('settings')}
                onPrompt={sendAiQuestion}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DailyRoutinePanel({
  routine, todayTodos, dailyLog, onToggleTodo, onNavigate, upcoming,
}: {
  routine: string[]
  todayTodos: Todo[]
  dailyLog: DailyLogState
  onToggleTodo: (id: string) => void
  onNavigate: (v: View) => void
  upcoming: { id: string; title: string; date: string; time?: string; color: string }[]
}) {
  const [input, setInput] = useState('')
  const [showWeek, setShowWeek] = useState(false)
  const activityLog = useActivityLog()
  const activities = activityLog.activities
  const weekLogs = showWeek ? dailyLog.getWeekLogs() : []

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    dailyLog.add(input)
    setInput('')
  }

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const diff = Math.round((Date.now() - d.getTime()) / 86400000)
    if (diff === 1) return '어제'
    if (diff === 2) return '그제'
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <section className="bg-white border border-surface-border rounded-xl p-4 space-y-3 flex flex-col" style={{ maxHeight: '240px' }}>
      <div className="flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-gray-900 text-sm">매일 하는 일</h2>
        <button onClick={() => onNavigate('todos')} className="text-xs text-gray-400 hover:text-gray-700">
          할 일 보기
        </button>
      </div>
      <div className="overflow-y-auto flex-1 space-y-3">

      {/* 루틴 */}
      {routine.length > 0 && (
        <ul className="space-y-1.5">
          {routine.slice(0, 5).map((item, idx) => (
            <li key={`${item}-${idx}`} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
              <span className="line-clamp-1">{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 오늘 마감 할 일 */}
      {todayTodos.length > 0 && (
        <div className="pt-2 border-t border-surface-border space-y-1.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">오늘 마감</p>
          {todayTodos.map(t => (
            <button key={t.id} onClick={() => onToggleTodo(t.id)}
              className="flex w-full items-center gap-2 text-left text-sm text-gray-700 hover:text-gray-900">
              <span className="h-4 w-4 rounded border border-surface-border shrink-0" />
              <span className="line-clamp-1">{t.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* 오늘 한 일 기록 */}
      <div className="pt-2 border-t border-surface-border space-y-2">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">오늘 활동</p>
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="직접 기록 후 Enter"
            className="flex-1 bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button type="submit" disabled={!input.trim()}
            className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 disabled:opacity-40">
            기록
          </button>
        </form>

        {/* 자동 + 수동 통합 목록 (최신순) */}
        {(activities.length > 0 || dailyLog.items.length > 0) ? (
          <ul className="space-y-1">
            {/* 자동 기록 - 최신순 */}
            {[...activities].reverse().map(a => (
              <li key={a.ts} className="group flex items-center gap-2">
                <span className="text-[10px] text-gray-300 shrink-0 w-10 text-right">{a.time}</span>
                <span className="flex-1 text-xs text-gray-600 line-clamp-1">{a.label}</span>
                <button onClick={() => activityLog.remove(a.ts)}
                  className="hidden group-hover:block text-gray-300 hover:text-red-400 text-xs shrink-0">×</button>
              </li>
            ))}
            {/* 수동 기록 */}
            {dailyLog.items.map((item, i) => (
              <li key={`m-${i}`} className="group flex items-center gap-2">
                <span className="text-[10px] text-gray-300 shrink-0 w-10 text-right">✓</span>
                <span className="flex-1 text-xs text-gray-800 line-clamp-1">{item}</span>
                <button onClick={() => dailyLog.remove(i)}
                  className="hidden group-hover:block text-gray-300 hover:text-red-400 text-xs shrink-0">×</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">활동이 감지되면 자동으로 기록됩니다.</p>
        )}
      </div>

      {/* 주간 요약 토글 */}
      <div className="pt-1 border-t border-surface-border">
        <button
          onClick={() => setShowWeek(v => !v)}
          className="w-full text-left text-[11px] text-gray-400 hover:text-gray-700 flex items-center justify-between py-0.5"
        >
          <span>주간 요약</span>
          <span>{showWeek ? '▲' : '▼'}</span>
        </button>
        {showWeek && (
          <div className="mt-2 space-y-2.5">
            {weekLogs.length === 0 ? (
              <p className="text-xs text-gray-400">최근 7일 기록이 없습니다.</p>
            ) : (
              weekLogs.map(log => (
                <div key={log.date}>
                  <p className="text-[10px] font-medium text-gray-500 mb-1">{fmtDate(log.date)}</p>
                  <ul className="space-y-0.5">
                    {log.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-300 shrink-0">✓</span>
                        <span className="line-clamp-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>{/* 주간 요약 끝 */}
      </div>{/* scroll div 끝 */}

      {/* 다가오는 일정 */}
      {upcoming.length > 0 && (
        <div className="pt-2 border-t border-surface-border space-y-1.5 shrink-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">다가오는 일정</p>
          {upcoming.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
              <div className="min-w-0">
                <p className="text-xs text-gray-800 truncate">{e.title}</p>
                <p className="text-[10px] text-gray-400">{e.date}{e.time ? ` ${e.time}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value, sub, color, onClick, setupRequired = false }: {
  label: string; value: number | string; sub: string; color: string; onClick?: () => void; setupRequired?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className="bg-surface border border-surface-border rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors"
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className={`text-xs mt-1 ${setupRequired ? 'text-red-500' : 'text-gray-400'}`}>{sub}</p>
    </div>
  )
}

function PdfMcpPanel({
  pdfUrl,
  activePdfUrl,
  mcpEndpoint,
  summary,
  loading,
  error,
  onUrlChange,
  onSubmit,
  onAskAi,
}: {
  pdfUrl: string
  activePdfUrl: string
  mcpEndpoint: string
  summary: PdfSummary | null
  loading: boolean
  error: string
  onUrlChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onAskAi: () => void
}) {
  return (
    <section className="bg-white border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 text-sm">PDF / 웹 요약</h2>
        {summary && (
          <button
            type="button"
            onClick={onAskAi}
            className="px-2 py-0.5 rounded bg-gray-900 text-white text-[11px] hover:bg-gray-700"
          >
            AI 해석
          </button>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <input
          value={pdfUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="PDF 또는 웹 URL"
          className="min-w-0 flex-1 bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          type="submit"
          disabled={!pdfUrl.trim() || loading}
          className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 disabled:opacity-40 shrink-0"
        >
          {loading ? '요약 중' : '요약'}
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {loading && <p className="text-xs text-gray-400">내용을 읽는 중입니다... (완료되면 AI 대화에 표시됩니다)</p>}
      {activePdfUrl && (
        <div className="h-48 overflow-hidden rounded-lg border border-surface-border bg-gray-50">
          <iframe src={`${pdfProxyUrl(mcpEndpoint, activePdfUrl)}#view=FitH`} title="PDF preview" className="h-full w-full border-0" />
        </div>
      )}
    </section>
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
    '최근 노트 내용을 읽고 핵심만 요약해줘',
    '오늘 제일 먼저 처리할 일을 정리해줘',
    '내 일정과 할 일을 보고 리스크를 알려줘',
    '주식 정보까지 포함해서 오늘 브리핑해줘',
  ]

  return (
    <aside className="flex-1 min-h-0 bg-white border border-surface-border rounded-xl flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 대화</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">현재 대시보드 정보를 보고 답변합니다.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-700">
            지우기
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0 p-4 space-y-3">
        {!hasApiKey ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <p className="text-sm text-red-500">Anthropic API 키가 필요합니다.</p>
            <button onClick={onNavigateSettings} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs hover:bg-gray-700">
              설정으로 이동
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 leading-relaxed">
              오른쪽에서 바로 질문하면 할 일, 일정, 노트, 주식 정보를 함께 참고해서 답변합니다.
            </p>
            <div className="space-y-2">
              {suggestions.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => onPrompt(prompt)}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover text-xs text-gray-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[88%] rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-gray-900 text-white rounded-tr-sm whitespace-pre-wrap'
                  : 'bg-surface border border-surface-border text-gray-800 rounded-tl-sm'
              }`}>
                {message.role === 'assistant'
                  ? (message.content
                      ? <ChatMarkdown content={message.content} />
                      : (loading && index === messages.length - 1 ? '답변 작성 중...' : ''))
                  : message.content}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-surface-border shrink-0">
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
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400 resize-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={!hasApiKey || loading || !input.trim()}
          className="mt-2 w-full py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
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
  if (title.startsWith('PDF')) return null

  return (
    <section className={`bg-white border border-surface-border rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-xs text-gray-400 hover:text-gray-700">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function SortablePanelWrapper({ id, label, editMode, children }: {
  id: string
  label: string
  editMode: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-1 left-0 right-0 z-10 flex items-center justify-center gap-2 py-1 bg-blue-500 text-white text-xs rounded-t-lg cursor-grab active:cursor-grabbing"
        >
          <span>⠿</span>
          <span>{label}</span>
          <span>⠿</span>
        </div>
      )}
      <div className={editMode ? 'pt-6 ring-2 ring-blue-300 ring-offset-1 rounded-xl' : ''}>
        {children}
      </div>
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-xs py-1 text-center leading-relaxed">{children}</p>
}

function SetupText({ children }: { children: React.ReactNode }) {
  return <p className="text-red-500 text-xs py-4 text-center leading-relaxed">{children}</p>
}
