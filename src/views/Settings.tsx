import { useState } from 'react'
import type { CalendarAccount, ChatConnection, ConnectionAuth, ConnectionAuthMode, MailAccount, Settings } from '@/types'
import { listMcpTools } from '@/services/mcp'

interface Props {
  settings: Settings
  onSave: (patch: Partial<Settings>) => void
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function SettingsView({ settings, onSave }: Props) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const firstMail = form.mailAccounts[0]
    const firstSlack = form.chatConnections.find(c => c.platform === 'slack')
    const firstTelegram = form.chatConnections.find(c => c.platform === 'telegram')

    onSave({
      ...form,
      gmailClientId: firstMail?.clientId || form.calendarAccounts[0]?.clientId || '',
      slackToken: firstSlack?.token || '',
      slackChannelId: firstSlack?.channelId || '',
      telegramToken: firstTelegram?.token || '',
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function setField<K extends keyof Settings>(field: K, value: Settings[K]) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function updateMail(id: string, patch: Partial<MailAccount>) {
    setForm(p => ({
      ...p,
      mailAccounts: p.mailAccounts.map(a => a.id === id ? { ...a, ...patch } : a),
    }))
  }

  function updateCalendar(id: string, patch: Partial<CalendarAccount>) {
    setForm(p => ({
      ...p,
      calendarAccounts: p.calendarAccounts.map(a => a.id === id ? { ...a, ...patch } : a),
    }))
  }

  function updateChat(id: string, patch: Partial<ChatConnection>) {
    setForm(p => ({
      ...p,
      chatConnections: p.chatConnections.map(c => c.id === id ? { ...c, ...patch } : c),
    }))
  }

  const addMail = () => setForm(p => ({
    ...p,
    mailAccounts: [...p.mailAccounts, { id: newId('mail'), name: `Mail ${p.mailAccounts.length + 1}`, provider: 'mcp', mcpEndpoint: p.mcpEndpoint, inboxTool: 'mail.inbox', auth: { mode: 'none' } }],
  }))

  const addCalendar = () => setForm(p => ({
    ...p,
    calendarAccounts: [...p.calendarAccounts, { id: newId('cal'), name: `Calendar ${p.calendarAccounts.length + 1}`, provider: 'mcp', mcpEndpoint: p.mcpEndpoint, eventsTool: 'calendar.events', auth: { mode: 'none' } }],
  }))

  const addChat = (platform: ChatConnection['platform']) => setForm(p => ({
    ...p,
    chatConnections: [
      ...p.chatConnections,
      {
        id: newId(platform),
        name: platform === 'mcp' ? `MCP Chat ${p.chatConnections.length + 1}` : platform === 'slack' ? `Slack ${p.chatConnections.length + 1}` : `Telegram ${p.chatConnections.length + 1}`,
        platform,
        token: '',
        channelId: '',
        mcpEndpoint: platform === 'mcp' ? p.mcpEndpoint : '',
        channelsTool: platform === 'mcp' ? 'chat.channels' : '',
        messagesTool: platform === 'mcp' ? 'chat.messages' : '',
        auth: { mode: 'none' },
      },
    ],
  }))

  function mergeById<T extends { id: string }>(current: T[], incoming: T[] = []) {
    const next = [...current]
    for (const item of incoming) {
      const idx = next.findIndex(v => v.id === item.id)
      if (idx >= 0) next[idx] = { ...next[idx], ...item }
      else next.push(item)
    }
    return next
  }

  async function importSettingsFile(file: File | undefined) {
    if (!file) return
    try {
      const imported = JSON.parse(await file.text())
      const payload = imported.settings || imported
      setForm(p => ({
        ...p,
        ...payload,
        mailAccounts: mergeById(p.mailAccounts, payload.mailAccounts),
        calendarAccounts: mergeById(p.calendarAccounts, payload.calendarAccounts),
        chatConnections: mergeById(p.chatConnections, payload.chatConnections),
      }))
      setImportMessage(`${file.name} 파일을 병합했습니다.`)
    } catch {
      setImportMessage('설정 파일을 읽지 못했습니다. JSON 형식을 확인해주세요.')
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">설정</h1>

        <form onSubmit={handleSave} className="space-y-5">
          <Section title="설정 파일 가져오기">
            <label className="block">
              <input
                type="file"
                accept="application/json,.json"
                onChange={e => importSettingsFile(e.target.files?.[0])}
                className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </label>
            <p className="text-xs text-gray-500 leading-relaxed">
              JSON 파일의 설정을 현재 값에 병합합니다. 같은 id의 연결은 업데이트하고, 새 id는 목록에 추가합니다. MCP 연결의 extraArgs는 tool arguments에 함께 전달됩니다.
            </p>
            {importMessage && <p className="text-xs text-gray-600">{importMessage}</p>}
          </Section>

          <Section title="프로필">
            <Field label="이름" value={form.userName} onChange={v => setField('userName', v)} placeholder="사용자 이름" />
            <Field label="도시" value={form.city} onChange={v => setField('city', v)} placeholder="Seoul" />
            <TextArea
              label="매일 하는 일"
              value={form.dailyRoutine}
              onChange={v => setField('dailyRoutine', v)}
              placeholder={'아침 회의 준비\n거래처 확인\n마감 전 관련 종목 점검'}
            />
          </Section>

          <Section title="데이터 연결 방식">
            <div className="grid grid-cols-2 gap-2">
              {(['api-key', 'mcp'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setField('dataAccessMode', mode)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    form.dataAccessMode === mode
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-surface-border bg-white text-gray-600 hover:bg-surface-hover'
                  }`}
                >
                  <span className="block text-sm font-semibold">{mode === 'api-key' ? 'API_KEY' : 'MCP'}</span>
                </button>
              ))}
            </div>
            <Field label="MCP 엔드포인트" value={form.mcpEndpoint} onChange={v => setField('mcpEndpoint', v)} placeholder="http://127.0.0.1:8765/mcp" />
            <McpQuickSetupBar
              endpoint={form.mcpEndpoint}
              onSetup={(mail, cal, chat) => setForm(p => ({
                ...p,
                mailAccounts: mergeById(p.mailAccounts, mail),
                calendarAccounts: mergeById(p.calendarAccounts, cal),
                chatConnections: mergeById(p.chatConnections, chat),
              }))}
            />
          </Section>

          <Section title="API 키">
            <Field label="Anthropic" value={form.anthropicApiKey} onChange={v => setField('anthropicApiKey', v)} type="password" placeholder="sk-ant-..." />
            <Field label="OpenWeatherMap" value={form.weatherApiKey} onChange={v => setField('weatherApiKey', v)} type="password" />
            <Field label="Finnhub" value={form.finnhubApiKey} onChange={v => setField('finnhubApiKey', v)} type="password" />
            <Field label="관심 종목" value={form.stockSymbols} onChange={v => setField('stockSymbols', v)} placeholder="AAPL, MSFT, NVDA, 005930.KS" />
          </Section>

          <Section title="메일 계정" action={<SmallButton onClick={addMail}>추가</SmallButton>}>
            {form.mailAccounts.length === 0 && <SetupText>Gmail 계정을 추가하세요.</SetupText>}
            {form.mailAccounts.map(account => (
              <ConnectionRow key={account.id} onRemove={() => setField('mailAccounts', form.mailAccounts.filter(a => a.id !== account.id))}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="표시 이름" value={account.name} onChange={v => updateMail(account.id, { name: v })} />
                  <Select
                    label="종류"
                    value={account.provider}
                    onChange={v => updateMail(account.id, {
                      provider: v as MailAccount['provider'],
                      mcpEndpoint: v === 'mcp' ? account.mcpEndpoint || form.mcpEndpoint : account.mcpEndpoint,
                      inboxTool: v === 'mcp' ? account.inboxTool || 'mail.inbox' : account.inboxTool,
                    })}
                    options={[['mcp', 'MCP'], ['gmail', 'Gmail']]}
                  />
                </div>
                {account.provider === 'mcp' ? (
                  <>
                    <Field label="MCP 엔드포인트" value={account.mcpEndpoint || ''} onChange={v => updateMail(account.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                    <McpTestButton endpoint={account.mcpEndpoint || ''} auth={account.auth} />
                    <McpToolField label="받은편지함 Tool" endpoint={account.mcpEndpoint || ''} auth={account.auth} value={account.inboxTool || ''} onChange={v => updateMail(account.id, { inboxTool: v })} defaultPlaceholder="mail.inbox" />
                    <AuthFields auth={account.auth} onChange={auth => updateMail(account.id, { auth })} />
                    <ExtraArgsFields value={account.extraArgs} onChange={extraArgs => updateMail(account.id, { extraArgs })} />
                  </>
                ) : (
                  <Field label="Gmail OAuth2 Client ID" value={account.clientId || ''} onChange={v => updateMail(account.id, { clientId: v })} placeholder="123456789-xxx.apps.googleusercontent.com" />
                )}
              </ConnectionRow>
            ))}
          </Section>

          <Section title="캘린더 계정" action={<SmallButton onClick={addCalendar}>추가</SmallButton>}>
            {form.calendarAccounts.length === 0 && <SetupText>Google Calendar 계정을 추가하세요.</SetupText>}
            {form.calendarAccounts.map(account => (
              <ConnectionRow key={account.id} onRemove={() => setField('calendarAccounts', form.calendarAccounts.filter(a => a.id !== account.id))}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="표시 이름" value={account.name} onChange={v => updateCalendar(account.id, { name: v })} />
                  <Select
                    label="종류"
                    value={account.provider}
                    onChange={v => updateCalendar(account.id, {
                      provider: v as CalendarAccount['provider'],
                      mcpEndpoint: v === 'mcp' ? account.mcpEndpoint || form.mcpEndpoint : account.mcpEndpoint,
                      eventsTool: v === 'mcp' ? account.eventsTool || 'calendar.events' : account.eventsTool,
                    })}
                    options={[['mcp', 'MCP'], ['google', 'Google']]}
                  />
                </div>
                {account.provider === 'mcp' ? (
                  <>
                    <Field label="MCP 엔드포인트" value={account.mcpEndpoint || ''} onChange={v => updateCalendar(account.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                    <McpTestButton endpoint={account.mcpEndpoint || ''} auth={account.auth} />
                    <McpToolField label="일정 Tool" endpoint={account.mcpEndpoint || ''} auth={account.auth} value={account.eventsTool || ''} onChange={v => updateCalendar(account.id, { eventsTool: v })} defaultPlaceholder="calendar.events" />
                    <AuthFields auth={account.auth} onChange={auth => updateCalendar(account.id, { auth })} />
                    <ExtraArgsFields value={account.extraArgs} onChange={extraArgs => updateCalendar(account.id, { extraArgs })} />
                  </>
                ) : (
                  <Field label="Google OAuth2 Client ID" value={account.clientId || ''} onChange={v => updateCalendar(account.id, { clientId: v })} placeholder="123456789-xxx.apps.googleusercontent.com" />
                )}
              </ConnectionRow>
            ))}
          </Section>

          <Section title="채팅 서버" action={
            <div className="flex gap-2">
              <SmallButton onClick={() => addChat('slack')}>Slack</SmallButton>
              <SmallButton onClick={() => addChat('telegram')}>Telegram</SmallButton>
              <SmallButton onClick={() => addChat('mcp')}>MCP</SmallButton>
            </div>
          }>
            {form.chatConnections.length === 0 && <SetupText>Slack 또는 Telegram 연결을 추가하세요.</SetupText>}
            {form.chatConnections.map(conn => (
              <ConnectionRow key={conn.id} onRemove={() => setField('chatConnections', form.chatConnections.filter(c => c.id !== conn.id))}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="표시 이름" value={conn.name} onChange={v => updateChat(conn.id, { name: v })} />
                  <Select
                    label="종류"
                    value={conn.platform}
                    onChange={v => updateChat(conn.id, { platform: v as ChatConnection['platform'], channelId: v === 'telegram' ? '' : conn.channelId })}
                    options={[['mcp', 'MCP'], ['slack', 'Slack'], ['telegram', 'Telegram']]}
                  />
                </div>
                {conn.platform === 'mcp' ? (
                  <>
                    <Field label="MCP 엔드포인트" value={conn.mcpEndpoint || ''} onChange={v => updateChat(conn.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                    <McpTestButton endpoint={conn.mcpEndpoint || ''} auth={conn.auth} />
                    <McpToolField label="채널 목록 Tool" endpoint={conn.mcpEndpoint || ''} auth={conn.auth} value={conn.channelsTool || ''} onChange={v => updateChat(conn.id, { channelsTool: v })} defaultPlaceholder="chat.channels" />
                    <McpToolField label="메시지 Tool" endpoint={conn.mcpEndpoint || ''} auth={conn.auth} value={conn.messagesTool || ''} onChange={v => updateChat(conn.id, { messagesTool: v })} defaultPlaceholder="chat.messages" />
                    <Field label="기본 채널 ID" value={conn.channelId || ''} onChange={v => updateChat(conn.id, { channelId: v })} />
                    <AuthFields auth={conn.auth} onChange={auth => updateChat(conn.id, { auth })} />
                    <ExtraArgsFields value={conn.extraArgs} onChange={extraArgs => updateChat(conn.id, { extraArgs })} />
                  </>
                ) : (
                  <Field label={conn.platform === 'slack' ? 'Slack Bot Token' : 'Telegram Bot Token'} value={conn.token || ''} onChange={v => updateChat(conn.id, { token: v })} type="password" />
                )}
                {conn.platform === 'slack' && (
                  <Field label="기본 채널 ID" value={conn.channelId || ''} onChange={v => updateChat(conn.id, { channelId: v })} placeholder="C0XXXXXXXXX" />
                )}
              </ConnectionRow>
            ))}
          </Section>

          <button
            type="submit"
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'
            }`}
          >
            {saved ? '저장됨' : '저장'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children, action }: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="bg-white border border-surface-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
      />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder = '' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
    </label>
  )
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
      >
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  )
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium transition-colors"
    >
      {children}
    </button>
  )
}

function ConnectionRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">삭제</button>
      </div>
      {children}
    </div>
  )
}

function SetupText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-500">{children}</p>
}

function AuthFields({ auth, onChange }: {
  auth?: ConnectionAuth
  onChange: (auth: ConnectionAuth) => void
}) {
  const current = auth || { mode: 'none' as ConnectionAuthMode }
  const update = (patch: Partial<ConnectionAuth>) => onChange({ ...current, ...patch })

  return (
    <div className="border border-surface-border rounded-xl p-3 space-y-3">
      <Select
        label="인증 방식"
        value={current.mode}
        onChange={v => update({ mode: v as ConnectionAuthMode })}
        options={[['none', '없음'], ['api-key', 'API Key'], ['username-api-key', '사용자 이름 + API Key'], ['account-password', '계정 + 비밀번호']]}
      />
      {current.mode === 'api-key' && (
        <Field label="API Key" value={current.apiKey || ''} onChange={v => update({ apiKey: v })} type="password" />
      )}
      {current.mode === 'username-api-key' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="사용자 이름" value={current.username || ''} onChange={v => update({ username: v })} />
          <Field label="API Key" value={current.apiKey || ''} onChange={v => update({ apiKey: v })} type="password" />
        </div>
      )}
      {current.mode === 'account-password' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="계정" value={current.username || ''} onChange={v => update({ username: v })} />
          <Field label="비밀번호" value={current.password || ''} onChange={v => update({ password: v })} type="password" />
        </div>
      )}
    </div>
  )
}

function ExtraArgsFields({ value, onChange }: {
  value?: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const [text, setText] = useState(() => value ? JSON.stringify(value, null, 2) : '{}')
  const [error, setError] = useState('')

  function update(raw: string) {
    setText(raw)
    try {
      const parsed = JSON.parse(raw || '{}')
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        setError('JSON 객체 형식이어야 합니다.')
        return
      }
      setError('')
      onChange(parsed)
    } catch {
      setError('JSON 형식이 올바르지 않습니다.')
    }
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">추가 인자(JSON)</span>
      <textarea
        value={text}
        onChange={e => update(e.target.value)}
        rows={4}
        className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 font-mono text-xs text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
      <span className={`text-xs ${error ? 'text-red-500' : 'text-gray-400'}`}>
        {error || 'MCP tool arguments에 병합됩니다.'}
      </span>
    </label>
  )
}

function McpTestButton({ endpoint, auth }: { endpoint: string; auth?: ConnectionAuth }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [info, setInfo] = useState('')

  async function test() {
    if (!endpoint) return
    setStatus('loading')
    try {
      const tools = await listMcpTools(endpoint, auth)
      setStatus('ok')
      setInfo(`도구 ${tools.length}개`)
    } catch (e: any) {
      setStatus('error')
      setInfo(e.message || '연결 실패')
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={test}
        disabled={!endpoint || status === 'loading'}
        className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-surface-border disabled:opacity-40"
      >
        {status === 'loading' ? '테스트 중...' : '연결 테스트'}
      </button>
      {status === 'ok' && <span className="text-xs text-green-600">✓ {info}</span>}
      {status === 'error' && <span className="text-xs text-red-500">✗ {info}</span>}
    </div>
  )
}

function McpToolField({ label, endpoint, auth, value, onChange, defaultPlaceholder = '' }: {
  label: string
  endpoint: string
  auth?: ConnectionAuth
  value: string
  onChange: (v: string) => void
  defaultPlaceholder?: string
}) {
  const [tools, setTools] = useState<Array<{ name: string; description?: string }>>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!endpoint) return
    setLoading(true)
    try {
      setTools(await listMcpTools(endpoint, auth))
      setOpen(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-1.5 relative">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={defaultPlaceholder}
          className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          type="button"
          onClick={load}
          disabled={!endpoint || loading}
          className="px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs rounded-xl border border-surface-border disabled:opacity-40 shrink-0"
          title="MCP 서버에서 도구 목록 불러오기"
        >
          {loading ? '...' : '목록'}
        </button>
      </div>
      {open && tools.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-surface-border rounded-xl shadow-lg overflow-hidden">
          {tools.map(t => (
            <button
              key={t.name}
              type="button"
              onClick={() => { onChange(t.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover"
            >
              <span className="font-medium text-gray-900">{t.name}</span>
              {t.description && <span className="ml-2 text-gray-400 truncate">{t.description}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function McpQuickSetupBar({ endpoint, onSetup }: {
  endpoint: string
  onSetup: (mail: MailAccount[], cal: CalendarAccount[], chat: ChatConnection[]) => void
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function run() {
    if (!endpoint) return
    setStatus('loading')
    try {
      const tools = await listMcpTools(endpoint)
      const names = tools.map((t: { name: string }) => t.name)

      const mailTools = names.filter((n: string) => /mail|inbox|email/i.test(n))
      const calTools = names.filter((n: string) => /calendar|event|schedule/i.test(n))
      const chatTools = names.filter((n: string) => /chat|message|channel|slack|telegram/i.test(n))

      const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      const mail: MailAccount[] = mailTools.length
        ? [{ id: newId('mail'), name: 'MCP Mail', provider: 'mcp', mcpEndpoint: endpoint, inboxTool: mailTools[0], auth: { mode: 'none' } }]
        : []
      const cal: CalendarAccount[] = calTools.length
        ? [{ id: newId('cal'), name: 'MCP Calendar', provider: 'mcp', mcpEndpoint: endpoint, eventsTool: calTools[0], auth: { mode: 'none' } }]
        : []
      const chat: ChatConnection[] = chatTools.length
        ? [{ id: newId('chat'), name: 'MCP Chat', platform: 'mcp', token: '', channelId: '', mcpEndpoint: endpoint, channelsTool: chatTools.find((n: string) => /channel/i.test(n)) || chatTools[0], messagesTool: chatTools.find((n: string) => /message/i.test(n)) || chatTools[0], auth: { mode: 'none' } }]
        : []

      onSetup(mail, cal, chat)
      setStatus('done')
      setMsg(`메일 ${mail.length}·캘린더 ${cal.length}·채팅 ${chat.length}개 연결 생성`)
    } catch (e: any) {
      setStatus('error')
      setMsg(e.message || '도구 탐색 실패')
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-surface-border rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800">MCP 빠른 설정</p>
        <p className="text-[11px] text-gray-500 mt-0.5">도구를 탐색해 메일·캘린더·채팅 연결을 자동 생성합니다.</p>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={!endpoint || status === 'loading'}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:bg-gray-700 disabled:opacity-40"
      >
        {status === 'loading' ? '탐색 중...' : '자동 설정'}
      </button>
      {(status === 'done' || status === 'error') && (
        <span className={`text-xs ${status === 'done' ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>
      )}
    </div>
  )
}
