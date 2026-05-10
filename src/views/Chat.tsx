import { useState, useEffect, useRef } from 'react'
import type { Settings, View } from '@/types'
import {
  fetchChannels, fetchMessages, formatSlackTs, type SlackChannel, type SlackMessage,
} from '@/services/slack'
import {
  getTelegramMe, fetchTelegramUpdates, formatTgDate, senderName, type TelegramMessage,
} from '@/services/telegram'

type Platform = 'slack' | 'telegram'

interface Props {
  settings: Settings
  onNavigate: (v: View) => void
}

export default function Chat({ settings, onNavigate }: Props) {
  const platform: Platform =
    settings.slackToken ? 'slack' : settings.telegramToken ? 'telegram' : 'slack'
  const [tab, setTab] = useState<Platform>(platform)

  const hasSlack = !!settings.slackToken
  const hasTelegram = !!settings.telegramToken

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="px-6 py-3 border-b border-surface-border flex items-center gap-2">
        <h1 className="text-sm font-bold text-white mr-3">💬 채팅</h1>
        <button
          onClick={() => setTab('slack')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tab === 'slack' ? 'bg-[#4A154B] text-white' : 'bg-surface text-gray-400 hover:text-white'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 54 54" fill="none">
            <path d="M19.712.133a5.381 5.381 0 00-5.376 5.387 5.381 5.381 0 005.376 5.386h5.376V5.52A5.381 5.381 0 0019.712.133m0 14.365H5.376A5.381 5.381 0 000 19.884a5.381 5.381 0 005.376 5.387h14.336a5.381 5.381 0 005.376-5.387 5.381 5.381 0 00-5.376-5.386" fill="#36C5F0"/>
            <path d="M53.76 19.884a5.381 5.381 0 00-5.376-5.386 5.381 5.381 0 00-5.376 5.386v5.387h5.376a5.381 5.381 0 005.376-5.387m-14.336 0V5.52A5.381 5.381 0 0034.048.133a5.381 5.381 0 00-5.376 5.387v14.364a5.381 5.381 0 005.376 5.387 5.381 5.381 0 005.376-5.387" fill="#2EB67D"/>
            <path d="M34.048 54a5.381 5.381 0 005.376-5.387 5.381 5.381 0 00-5.376-5.386h-5.376v5.386A5.381 5.381 0 0034.048 54m0-14.365h14.336a5.381 5.381 0 005.376-5.386 5.381 5.381 0 00-5.376-5.387H34.048a5.381 5.381 0 00-5.376 5.387 5.381 5.381 0 005.376 5.386" fill="#ECB22E"/>
            <path d="M0 34.249a5.381 5.381 0 005.376 5.386 5.381 5.381 0 005.376-5.386v-5.387H5.376A5.381 5.381 0 000 34.249m14.336 0v14.364A5.381 5.381 0 0019.712 54a5.381 5.381 0 005.376-5.387V34.249a5.381 5.381 0 00-5.376-5.387 5.381 5.381 0 00-5.376 5.387" fill="#E01E5A"/>
          </svg>
          Slack
          {hasSlack && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
        </button>
        <button
          onClick={() => setTab('telegram')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tab === 'telegram' ? 'bg-[#0088cc] text-white' : 'bg-surface text-gray-400 hover:text-white'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.007 9.456c-.148.658-.538.818-1.09.508l-3.008-2.216-1.452 1.397c-.16.16-.295.295-.606.295l.216-3.063 5.578-5.038c.242-.216-.053-.336-.375-.12L7.23 14.807l-2.964-.924c-.645-.203-.658-.645.135-.955l11.56-4.457c.537-.194 1.008.12.601.776z"/>
          </svg>
          Telegram
          {hasTelegram && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className="ml-auto text-xs text-gray-500 hover:text-accent transition-colors"
        >
          ⚙ API 키 설정
        </button>
      </div>

      {tab === 'slack'
        ? <SlackView settings={settings} onNavigate={onNavigate} />
        : <TelegramView settings={settings} onNavigate={onNavigate} />
      }
    </div>
  )
}

/* ──────────── Slack ──────────── */
function SlackView({ settings, onNavigate }: Props) {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState(settings.slackChannelId || '')
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settings.slackToken) return
    fetchChannels(settings.slackToken)
      .then(chs => {
        setChannels(chs)
        if (!selectedChannel && chs.length > 0) setSelectedChannel(chs[0].id)
      })
      .catch(e => setError(e.message))
  }, [settings.slackToken])

  useEffect(() => {
    if (selectedChannel && settings.slackToken) loadMessages()
  }, [selectedChannel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    if (!settings.slackToken || !selectedChannel) return
    setLoading(true)
    try {
      const msgs = await fetchMessages(settings.slackToken, selectedChannel)
      setMessages([...msgs].reverse())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!settings.slackToken) return <ConnectPrompt platform="Slack" onNavigate={onNavigate} keyName="Slack Bot Token" />

  const currentChannel = channels.find(c => c.id === selectedChannel)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Channel list */}
      <div className="w-48 shrink-0 bg-[#0d0d1a] border-r border-surface-border flex flex-col">
        <p className="px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">채널</p>
        <div className="flex-1 overflow-auto">
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                ch.id === selectedChannel ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-surface'
              }`}
            >
              # {ch.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm text-white font-medium">#{currentChannel?.name || '채널 선택'}</span>
          <button onClick={loadMessages} disabled={loading} className="text-xs text-gray-500 hover:text-accent transition-colors disabled:opacity-50">
            {loading ? '...' : '새로고침'}
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {messages.map(msg => (
            <div key={msg.ts} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-md bg-surface-card flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                {(msg.username || msg.user || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-200">{msg.username || msg.user}</span>
                  <span className="text-[10px] text-gray-600">{formatSlackTs(msg.ts)}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

/* ──────────── Telegram ──────────── */
function TelegramView({ settings, onNavigate }: Props) {
  const [botName, setBotName] = useState<string | null>(null)
  const [messages, setMessages] = useState<TelegramMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settings.telegramToken) return
    getTelegramMe(settings.telegramToken)
      .then(me => { setBotName(me.first_name); loadMessages() })
      .catch(e => setError(e.message))
  }, [settings.telegramToken])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    if (!settings.telegramToken) return
    setLoading(true)
    try {
      setMessages(await fetchTelegramUpdates(settings.telegramToken))
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!settings.telegramToken) return <ConnectPrompt platform="Telegram" onNavigate={onNavigate} keyName="Bot API Token" />

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-2 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {botName && <span className="text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" />@{botName}</span>}
        </div>
        <button onClick={loadMessages} disabled={loading} className="text-xs text-gray-500 hover:text-accent disabled:opacity-50">
          {loading ? '...' : '새로고침'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {error && <p className="text-red-400 text-xs bg-red-500/10 p-2 rounded-lg">{error}</p>}
        {messages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p className="text-2xl mb-2">💬</p>
            <p>봇에게 메시지를 보내면 여기서 볼 수 있습니다</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.message_id} className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-xs text-[#0088cc] font-bold shrink-0">
              {senderName(msg)[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-200">{senderName(msg)}</span>
                <span className="text-[10px] text-gray-600">{formatTgDate(msg.date)}</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

/* ──────────── 미연결 안내 ──────────── */
function ConnectPrompt({ platform, onNavigate, keyName }: { platform: string; onNavigate: (v: View) => void; keyName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <span className="text-4xl">💬</span>
      <div className="text-center space-y-1.5">
        <h3 className="text-lg font-bold text-white">{platform} 연결</h3>
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
          설정에서 {keyName}를 입력하면 {platform} 메시지를 대시보드에서 볼 수 있습니다.
        </p>
      </div>
      <button
        onClick={() => onNavigate('settings')}
        className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-xl transition-colors"
      >
        ⚙ 설정으로 이동
      </button>
    </div>
  )
}
