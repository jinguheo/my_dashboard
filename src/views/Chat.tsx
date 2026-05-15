import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatConnection, Settings, View } from '@/types'
import {
  fetchChannels, fetchChatChannelsFromMcp, fetchChatMessagesFromMcp, fetchMessages, formatSlackTs, type SlackChannel, type SlackMessage,
} from '@/services/slack'
import {
  getTelegramMe, fetchTelegramUpdates, formatTgDate, senderName, type TelegramMessage,
} from '@/services/telegram'

interface Props {
  settings: Settings
  onNavigate: (v: View) => void
}

export default function Chat({ settings, onNavigate }: Props) {
  const connections = settings.chatConnections
  const [selectedId, setSelectedId] = useState(connections[0]?.id || '')
  const selected = useMemo(
    () => connections.find(c => c.id === selectedId) || connections[0],
    [connections, selectedId],
  )

  useEffect(() => {
    if (!selected && connections.length > 0) setSelectedId(connections[0].id)
  }, [connections, selected])

  if (connections.length === 0) {
    return <ConnectPrompt platform="채팅 서버" onNavigate={onNavigate} keyName="Slack 또는 Telegram 연결" />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-surface-border flex items-center gap-2">
        <h1 className="text-sm font-bold text-gray-900 mr-3">채팅</h1>
        <select
          value={selected?.id || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="bg-white border border-surface-border text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none"
        >
          {connections.map(conn => (
            <option key={conn.id} value={conn.id}>
              {conn.name || conn.platform} · {conn.platform === 'slack' ? 'Slack' : 'Telegram'}
            </option>
          ))}
        </select>
        <button onClick={() => onNavigate('settings')} className="ml-auto text-xs text-gray-400 hover:text-gray-700">
          서버 관리
        </button>
      </div>

      {selected?.platform === 'slack'
        ? <SlackView connection={selected} onNavigate={onNavigate} />
        : selected?.platform === 'mcp'
          ? <McpChatView connection={selected} onNavigate={onNavigate} />
          : selected ? <TelegramView connection={selected} onNavigate={onNavigate} /> : null
      }
    </div>
  )
}

function SlackView({ connection, onNavigate }: { connection: ChatConnection; onNavigate: (v: View) => void }) {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState(connection.channelId || '')
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setChannels([])
    setMessages([])
    setSelectedChannel(connection.channelId || '')
    setError(null)
    if (!connection.token) return
    fetchChannels(connection.token)
      .then(chs => {
        setChannels(chs)
        const defaultChannel = connection.channelId && chs.some(c => c.id === connection.channelId)
          ? connection.channelId
          : chs[0]?.id || ''
        setSelectedChannel(defaultChannel)
      })
      .catch(e => setError(e.message))
  }, [connection.id, connection.token, connection.channelId])

  useEffect(() => {
    if (selectedChannel && connection.token) loadMessages()
  }, [selectedChannel, connection.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    if (!connection.token || !selectedChannel) return
    setLoading(true)
    setError(null)
    try {
      const msgs = await fetchMessages(connection.token, selectedChannel)
      setMessages([...msgs].reverse())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!connection.token) return <ConnectPrompt platform="Slack" onNavigate={onNavigate} keyName="Slack Bot Token" />

  const currentChannel = channels.find(c => c.id === selectedChannel)

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-48 shrink-0 bg-gray-50 border-r border-surface-border flex flex-col">
        <p className="px-3 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{connection.name}</p>
        <div className="flex-1 overflow-auto">
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                ch.id === selectedChannel ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              # {ch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm text-gray-900 font-medium">#{currentChannel?.name || '채널 선택'}</span>
          <button onClick={loadMessages} disabled={loading} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50">
            {loading ? '...' : '새로고침'}
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {messages.map(msg => (
            <div key={msg.ts} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                {(msg.username || msg.user || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-800">{msg.username || msg.user}</span>
                  <span className="text-[10px] text-gray-400">{formatSlackTs(msg.ts)}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function TelegramView({ connection, onNavigate }: { connection: ChatConnection; onNavigate: (v: View) => void }) {
  const [botName, setBotName] = useState<string | null>(null)
  const [messages, setMessages] = useState<TelegramMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    setBotName(null)
    setError(null)
    if (!connection.token) return
    getTelegramMe(connection.token)
      .then(me => { setBotName(me.first_name); loadMessages() })
      .catch(e => setError(e.message))
  }, [connection.id, connection.token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    if (!connection.token) return
    setLoading(true)
    setError(null)
    try {
      setMessages(await fetchTelegramUpdates(connection.token))
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!connection.token) return <ConnectPrompt platform="Telegram" onNavigate={onNavigate} keyName="Bot API Token" />

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-2 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{connection.name}</span>
          {botName && <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />@{botName}</span>}
        </div>
        <button onClick={loadMessages} disabled={loading} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50">
          {loading ? '...' : '새로고침'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {error && <p className="text-red-500 text-xs bg-red-50 border border-red-200 p-2 rounded-lg">{error}</p>}
        {messages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <p>봇에게 메시지를 보내면 여기에 표시됩니다.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.message_id} className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs text-blue-500 font-bold shrink-0">
              {senderName(msg)[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-800">{senderName(msg)}</span>
                <span className="text-[10px] text-gray-400">{formatTgDate(msg.date)}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function McpChatView({ connection, onNavigate }: { connection: ChatConnection; onNavigate: (v: View) => void }) {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState(connection.channelId || '')
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setChannels([])
    setMessages([])
    setSelectedChannel(connection.channelId || '')
    setError(null)
    if (!connection.mcpEndpoint) return
    fetchChatChannelsFromMcp(connection.mcpEndpoint, connection.channelsTool || 'chat.channels', connection.auth, connection.extraArgs)
      .then(chs => {
        setChannels(chs)
        const defaultChannel = connection.channelId && chs.some(c => c.id === connection.channelId)
          ? connection.channelId
          : chs[0]?.id || ''
        setSelectedChannel(defaultChannel)
      })
      .catch(e => setError(e.message))
  }, [connection.id, connection.mcpEndpoint, connection.channelsTool, connection.channelId])

  useEffect(() => {
    if (selectedChannel && connection.mcpEndpoint) loadMessages()
  }, [selectedChannel, connection.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    if (!connection.mcpEndpoint) return
    setLoading(true)
    setError(null)
    try {
      const msgs = await fetchChatMessagesFromMcp(connection.mcpEndpoint, connection.messagesTool || 'chat.messages', selectedChannel, connection.auth, connection.extraArgs)
      setMessages([...msgs].reverse())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!connection.mcpEndpoint) return <ConnectPrompt platform="MCP Chat" onNavigate={onNavigate} keyName="MCP 엔드포인트" />

  const currentChannel = channels.find(c => c.id === selectedChannel)

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-48 shrink-0 bg-gray-50 border-r border-surface-border flex flex-col">
        <p className="px-3 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{connection.name}</p>
        <div className="flex-1 overflow-auto">
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                ch.id === selectedChannel ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              # {ch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm text-gray-900 font-medium">#{currentChannel?.name || selectedChannel || 'MCP 채널'}</span>
          <button onClick={loadMessages} disabled={loading} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50">
            {loading ? '...' : '새로고침'}
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {messages.map(msg => (
            <div key={msg.ts} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                {(msg.username || msg.user || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-800">{msg.username || msg.user}</span>
                  <span className="text-[10px] text-gray-400">{formatSlackTs(msg.ts)}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function ConnectPrompt({ platform, onNavigate, keyName }: { platform: string; onNavigate: (v: View) => void; keyName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <div className="text-center space-y-1.5">
        <h3 className="text-lg font-bold text-gray-900">{platform} 연결</h3>
        <p className="text-red-500 text-sm max-w-xs leading-relaxed">
          설정에서 {keyName}을 입력하면 메시지를 볼 수 있습니다.
        </p>
      </div>
      <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-xl">
        설정으로 이동
      </button>
    </div>
  )
}
