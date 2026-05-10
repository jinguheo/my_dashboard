import { useState } from 'react'
import type { CalendarAccount, ChatConnection, ConnectionAuth, ConnectionAuthMode, MailAccount, Settings } from '@/types'

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
        <h1 className="text-xl font-bold text-white mb-6">설정</h1>

        <form onSubmit={handleSave} className="space-y-5">
          <Section title="설정 파일 가져오기">
            <label className="block">
              <input
                type="file"
                accept="application/json,.json"
                onChange={e => importSettingsFile(e.target.files?.[0])}
                className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:text-xs file:font-medium file:text-accent-light hover:file:bg-accent/25"
              />
            </label>
            <p className="text-xs text-gray-500 leading-relaxed">
              JSON 파일의 설정을 현재 값에 병합합니다. 같은 id의 연결은 업데이트하고, 새 id는 목록에 추가합니다. MCP 연결의 extraArgs는 tool arguments에 함께 전달됩니다.
            </p>
            {importMessage && <p className="text-xs text-accent-light">{importMessage}</p>}
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
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-surface-border bg-surface text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="block text-sm font-semibold">{mode === 'api-key' ? 'API_KEY' : 'MCP'}</span>
                </button>
              ))}
            </div>
            <Field label="MCP 엔드포인트" value={form.mcpEndpoint} onChange={v => setField('mcpEndpoint', v)} placeholder="http://127.0.0.1:8765/mcp" />
          </Section>

          <Section title="API 키">
            <Field label="Anthropic" value={form.anthropicApiKey} onChange={v => setField('anthropicApiKey', v)} type="password" placeholder="sk-ant-..." />
            <Field label="OpenWeatherMap" value={form.weatherApiKey} onChange={v => setField('weatherApiKey', v)} type="password" />
            <Field label="Finnhub" value={form.finnhubApiKey} onChange={v => setField('finnhubApiKey', v)} type="password" />
            <Field label="관심 종목" value={form.stockSymbols} onChange={v => setField('stockSymbols', v)} placeholder="AAPL, MSFT, NVDA, 005930.KS" />
          </Section>

          <Section title="메일 계정" action={<SmallButton onClick={addMail}>추가</SmallButton>}>
            {form.mailAccounts.length === 0 && <EmptyText>Gmail 계정을 추가하세요.</EmptyText>}
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
                    <Field label="받은편지함 Tool" value={account.inboxTool || 'mail.inbox'} onChange={v => updateMail(account.id, { inboxTool: v })} />
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
            {form.calendarAccounts.length === 0 && <EmptyText>Google Calendar 계정을 추가하세요.</EmptyText>}
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
                    <Field label="일정 Tool" value={account.eventsTool || 'calendar.events'} onChange={v => updateCalendar(account.id, { eventsTool: v })} />
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
            {form.chatConnections.length === 0 && <EmptyText>Slack 또는 Telegram 연결을 추가하세요.</EmptyText>}
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
                    <Field label="채널 목록 Tool" value={conn.channelsTool || 'chat.channels'} onChange={v => updateChat(conn.id, { channelsTool: v })} />
                    <Field label="메시지 Tool" value={conn.messagesTool || 'chat.messages'} onChange={v => updateChat(conn.id, { messagesTool: v })} />
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
              saved ? 'bg-green-500 text-white' : 'bg-accent hover:bg-accent-hover text-white'
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
    <section className="bg-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-accent-light">{title}</h2>
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
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-card rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50"
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
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-surface-card rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50 resize-none"
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
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-card rounded-xl px-4 py-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent/50"
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
      className="px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 text-xs font-medium transition-colors"
    >
      {children}
    </button>
  )
}

function ConnectionRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">삭제</button>
      </div>
      {children}
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>
}

function AuthFields({ auth, onChange }: {
  auth?: ConnectionAuth
  onChange: (auth: ConnectionAuth) => void
}) {
  const current = auth || { mode: 'none' as ConnectionAuthMode }
  const update = (patch: Partial<ConnectionAuth>) => onChange({ ...current, ...patch })

  return (
    <div className="border border-surface-border/60 rounded-xl p-3 space-y-3">
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
      <span className="text-sm font-medium text-gray-300">추가 인자(JSON)</span>
      <textarea
        value={text}
        onChange={e => update(e.target.value)}
        rows={4}
        className="w-full bg-surface-card rounded-xl px-4 py-2.5 font-mono text-xs text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50 resize-none"
      />
      <span className={`text-xs ${error ? 'text-red-400' : 'text-gray-500'}`}>
        {error || 'MCP tool arguments에 병합됩니다.'}
      </span>
    </label>
  )
}
