import { useState, useRef, useEffect } from 'react'
import ChatMarkdown from '@/components/ChatMarkdown'
import type { AIMessage, AiProvider, Settings } from '@/types'
import type { TodoState } from '@/store/useTodos'
import type { NoteState } from '@/store/useNotes'
import type { CalendarState } from '@/store/useCalendar'
import {
  streamChat,
  briefingSystem, reviewSystem, strategicSystem,
  buildBriefingMessage, buildReviewMessage,
} from '@/services/claude'
import { streamChatOpenAI } from '@/services/openai'
import { streamClaudeWeb } from '@/services/claudeWeb'

type Mode = 'briefing' | 'review' | 'chat'

interface Props {
  todos: TodoState
  notes: NoteState
  calendar: CalendarState
  settings: Settings
  onProviderChange: (provider: AiProvider) => void
  onNavigate?: (view: string) => void
}

function ClaudeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5L9 6H13.5L9.75 8.75L11.25 13.25L7.5 10.5L3.75 13.25L5.25 8.75L1.5 6H6Z" fill="currentColor" />
    </svg>
  )
}

function ChatGPTIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4.5 9.5C4.5 8.12 5.62 7 7 7H8C9.38 7 10.5 8.12 10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="7.5" cy="5.2" r="1.2" fill="currentColor" />
    </svg>
  )
}

function CustomIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.93 2.93l1.06 1.06M11.01 11.01l1.06 1.06M2.93 12.07l1.06-1.06M11.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function OllamaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M5 2.5C5 1.67 5.67 1 6.5 1h2c.83 0 1.5.67 1.5 1.5V4c1.1.5 2 1.6 2 3v4.5c0 1.1-.9 2-2 2H5.5c-1.1 0-2-.9-2-2V7c0-1.4.9-2.5 2-3V2.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="6" cy="8" r="0.9" fill="currentColor" />
      <circle cx="9" cy="8" r="0.9" fill="currentColor" />
    </svg>
  )
}

const PROVIDERS: { id: AiProvider; label: string; icon: React.ReactNode; active: string }[] = [
  { id: 'ollama',     label: 'Ollama (로컬)', icon: <OllamaIcon />, active: 'bg-sky-50 text-sky-600 border-sky-300' },
  { id: 'claude',     label: 'Claude API', icon: <ClaudeIcon />,  active: 'bg-orange-50 text-orange-600 border-orange-300' },
  { id: 'claude-web', label: 'Claude.ai 구독', icon: <ClaudeIcon />, active: 'bg-amber-50 text-amber-600 border-amber-300' },
  { id: 'chatgpt',    label: 'ChatGPT',    icon: <ChatGPTIcon />, active: 'bg-green-50 text-green-600 border-green-300' },
  { id: 'custom',     label: 'Custom',     icon: <CustomIcon />, active: 'bg-purple-50 text-purple-600 border-purple-300' },
]

const OLLAMA_ENDPOINT = 'http://localhost:11434/v1'
const OLLAMA_MODEL = 'gemma4:e2b'

export default function AI({ todos, notes, calendar, settings, onProviderChange, onNavigate }: Props) {
  const [mode, setMode] = useState<Mode>('briefing')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const provider = settings.aiProvider ?? 'ollama'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildContext(): string {
    const pending = todos.pending.map(t => `[${t.priority}] ${t.text}`).join('\n')
    const completed = todos.completedToday.map(t => t.text).join(', ')
    const recentNotes = notes.notes.slice(0, 3).map(n => `- ${n.title}: ${n.content.slice(0, 100)}`).join('\n')
    const events = calendar.upcoming(7).map(e => `${e.date} ${e.title}`).join(', ')
    return `[사용자 현황]\n미완료:\n${pending || '없음'}\n완료(오늘): ${completed || '없음'}\n일정: ${events || '없음'}\n노트:\n${recentNotes || '없음'}`
  }

  function getSystem(): string {
    const ctx = buildContext()
    if (mode === 'briefing') return `${briefingSystem(settings.userName)}\n\n${ctx}`
    if (mode === 'review') return `${reviewSystem(settings.userName)}\n\n${ctx}`
    return `${strategicSystem(settings.userName)}\n\n${ctx}`
  }

  async function callStream(
    msgs: Array<{ role: 'user' | 'assistant'; content: string }>,
    system: string,
    onDelta: (text: string) => void,
  ) {
    if (provider === 'ollama') {
      return streamChatOpenAI('', OLLAMA_ENDPOINT, OLLAMA_MODEL, msgs, system, onDelta)
    } else if (provider === 'claude') {
      return streamChat(settings.anthropicApiKey, msgs, system, onDelta)
    } else if (provider === 'claude-web') {
      return streamClaudeWeb(settings.claudeSessionKey, settings.mcpEndpoint, msgs, system, onDelta)
    } else if (provider === 'chatgpt') {
      return streamChatOpenAI(settings.openaiApiKey, 'https://api.openai.com/v1', 'gpt-4o', msgs, system, onDelta)
    } else {
      return streamChatOpenAI('', settings.customAiEndpoint, settings.customAiModel || 'gpt-4o', msgs, system, onDelta)
    }
  }

  const noKey = provider === 'ollama'
    ? false
    : provider === 'claude'
      ? !settings.anthropicApiKey
      : provider === 'claude-web'
        ? !settings.claudeSessionKey
        : provider === 'chatgpt'
          ? !settings.openaiApiKey
          : !settings.customAiEndpoint

  const noKeyMsg = provider === 'ollama'
    ? `로컬 Ollama(${OLLAMA_ENDPOINT})가 실행 중이어야 합니다.`
    : provider === 'claude'
      ? '설정에서 Anthropic API 키를 입력하면 AI 기능을 사용할 수 있습니다.'
      : provider === 'claude-web'
        ? '설정에서 Claude.ai 구독 계정으로 연결하세요.'
        : provider === 'chatgpt'
          ? '설정에서 OpenAI API 키를 입력하면 ChatGPT를 사용할 수 있습니다.'
          : '설정에서 Custom AI 엔드포인트를 입력하면 사용할 수 있습니다.'

  async function handleGenerate() {
    if (noKey) return
    setLoading(true)

    let userMsg = ''
    if (mode === 'briefing') {
      userMsg = buildBriefingMessage({
        pending: todos.pending.map(t => t.text),
        highPriority: todos.highPriority.map(t => t.text),
        completedToday: todos.completedToday.map(t => t.text),
        upcomingEvents: calendar.upcoming(7).map(e => `${e.date} ${e.title}`),
        recentNotes: notes.notes.slice(0, 3).map(n => n.title),
      })
    } else {
      userMsg = buildReviewMessage({
        completedToday: todos.completedToday.map(t => t.text),
        pending: todos.pending.map(t => t.text),
        recentNotes: notes.notes.slice(0, 3).map(n => n.title),
      })
    }

    const userMessage: AIMessage = { role: 'user', content: userMsg, timestamp: new Date().toISOString() }
    const assistantMessage: AIMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    setMessages(p => [...p, userMessage, assistantMessage])

    const idx = messages.length + 1
    try {
      await callStream(
        [{ role: 'user', content: userMsg }],
        getSystem(),
        (delta) => {
          setMessages(p => p.map((m, i) => i === idx ? { ...m, content: m.content + delta } : m))
        }
      )
    } catch (e: any) {
      const errMsg = e?.error?.message || e?.message || String(e)
      const is403 = errMsg.includes('403') || errMsg.toLowerCase().includes('세션 만료') || errMsg.toLowerCase().includes('session')
      if (is403) setSessionExpired(true)
      setMessages(p => p.map((m, i) => i === idx ? { ...m, content: `오류: ${errMsg}` } : m))
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || noKey || loading) return
    const userContent = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: AIMessage = { role: 'user', content: userContent, timestamp: new Date().toISOString() }
    const assistantMsg: AIMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg, assistantMsg]
    setMessages(newMessages)

    const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    const lastIdx = newMessages.length - 1

    try {
      await callStream(
        history as Array<{ role: 'user' | 'assistant'; content: string }>,
        getSystem(),
        (delta) => {
          setMessages(p => p.map((m, i) => i === lastIdx ? { ...m, content: m.content + delta } : m))
        }
      )
    } catch (e: any) {
      const errMsg = e?.error?.message || e?.message || String(e)
      const is403 = errMsg.includes('403') || errMsg.toLowerCase().includes('세션 만료') || errMsg.toLowerCase().includes('session')
      if (is403) setSessionExpired(true)
      setMessages(p => p.map((m, i) => i === lastIdx ? { ...m, content: `오류: ${errMsg}` } : m))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-3 border-b border-surface-border flex items-center gap-2 shrink-0 flex-wrap">
        <h1 className="text-sm font-bold text-gray-900 mr-2">✦ AI 어시스턴트</h1>

        {/* Provider selector icons */}
        <div className="flex items-center gap-1 mr-2 border-r border-surface-border pr-3">
          {PROVIDERS.map(({ id, label, icon, active }) => (
            <button
              key={id}
              title={label}
              onClick={() => onProviderChange(id)}
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                provider === id
                  ? active
                  : 'bg-white border-surface-border text-gray-400 hover:text-gray-600 hover:bg-surface-hover'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        {([['briefing', '🌅 아침 브리핑'], ['review', '📊 하루 리뷰'], ['chat', '💬 전략 대화']] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); setMessages([]) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === m ? 'bg-gray-900 text-white' : 'bg-surface border border-surface-border text-gray-600 hover:bg-surface-hover'
            }`}
          >
            {label}
          </button>
        ))}
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="ml-auto text-xs text-gray-400 hover:text-gray-700">
            대화 지우기
          </button>
        )}
      </div>

      {sessionExpired && provider === 'claude-web' && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm text-red-700 shrink-0">
          <span>⚠️ Claude.ai 세션이 만료됐습니다.</span>
          <button
            onClick={() => onNavigate?.('settings')}
            className="ml-auto shrink-0 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
          >
            설정에서 재연결
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0 px-6 py-4 space-y-4">
        {noKey && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🔑</p>
            <p className="text-red-500 text-sm">{noKeyMsg}</p>
          </div>
        )}

        {!noKey && messages.length === 0 && mode !== 'chat' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <span className="text-5xl">{mode === 'briefing' ? '🌅' : '📊'}</span>
            <p className="text-gray-500 text-sm text-center">
              {mode === 'briefing'
                ? `${settings.userName}님의 할 일, 일정, 노트를 분석해 오늘의 브리핑을 생성합니다.`
                : `오늘 하루를 돌아보는 리뷰를 생성합니다.`
              }
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '생성 중...' : mode === 'briefing' ? '브리핑 생성하기' : '리뷰 생성하기'}
            </button>
          </div>
        )}

        {!noKey && messages.length === 0 && mode === 'chat' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <span className="text-5xl">💬</span>
            <p className="text-gray-500 text-sm text-center">
              현재 할 일·노트·일정을 컨텍스트로 전략적 대화를 나눠보세요.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {['오늘 우선순위를 어떻게 정해야 할까요?', '이번 주 목표를 달성하려면?', '집중력을 높이는 방법은?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q) }}
                  className="text-left text-xs px-4 py-2.5 bg-surface border border-surface-border hover:bg-surface-hover rounded-lg text-gray-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}


        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0 mt-0.5">✦</div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-gray-900 text-white rounded-tr-sm whitespace-pre-wrap'
                : 'bg-surface border border-surface-border text-gray-800 rounded-tl-sm'
            }`}>
              {msg.role === 'assistant'
                ? (msg.content
                    ? <ChatMarkdown content={msg.content} />
                    : (loading && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : ''))
                : msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs shrink-0 mt-0.5 text-gray-600">나</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!noKey && mode === 'chat' && (
        <div className="px-6 py-4 border-t border-surface-border shrink-0">
          <div className="relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
              disabled={loading}
              rows={3}
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 pr-20 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50 resize-none min-h-[80px]"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-3 bottom-3 px-4 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
