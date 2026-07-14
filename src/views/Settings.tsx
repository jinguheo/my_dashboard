import { useEffect, useState } from 'react'
import type { CalendarAccount, ChatConnection, ConnectionAuth, ConnectionAuthMode, MailAccount, Settings } from '@/types'
import { listMcpTools } from '@/services/mcp'
import { fetchApiKeyViaLogin } from '@/services/apiKeyLogin'
import { claudeWebLogin, claudeWebCaptureSession } from '@/services/claudeWeb'
import { mergeRssFeedUrls, POPULAR_RSS_FEEDS } from '@/services/rss'
import {
  loadGoogleAuth, requestGmailToken, revokeGmailToken,
  getStoredToken, storeToken, clearGmailToken,
} from '@/services/gmail'

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

  function addPopularRssFeeds() {
    setForm(p => ({
      ...p,
      rssFeeds: mergeRssFeedUrls(p.rssFeeds || ''),
    }))
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

  const addMail = (provider: MailAccount['provider'] = 'mcp') => {
    const count = form.mailAccounts.length + 1
    const base = { id: newId('mail'), provider, auth: { mode: 'none' as const } }
    const byProvider: Partial<MailAccount> =
      provider === 'gmail'  ? { name: `Gmail ${count}` } :
      provider === 'naver'  ? { name: 'Naver Mail', imapHost: 'imap.naver.com', imapPort: 993, imapSsl: true, mcpEndpoint: form.mcpEndpoint, inboxTool: 'imap.inbox', auth: { mode: 'account-password', username: '', password: '' } } :
      provider === 'imap'   ? { name: `IMAP ${count}`, imapHost: '', imapPort: 993, imapSsl: true, mcpEndpoint: form.mcpEndpoint, inboxTool: 'imap.inbox', auth: { mode: 'account-password', username: '', password: '' } } :
      { name: `MCP Mail ${count}`, mcpEndpoint: form.mcpEndpoint, inboxTool: 'mail.inbox' }
    setForm(p => ({ ...p, mailAccounts: [...p.mailAccounts, { ...base, ...byProvider } as MailAccount] }))
  }

  const addCalendar = () => setForm(p => ({
    ...p,
    calendarAccounts: [...p.calendarAccounts, { id: newId('cal'), name: `Google Calendar ${p.calendarAccounts.length + 1}`, provider: 'ics', mcpEndpoint: p.mcpEndpoint, auth: { mode: 'none' } }],
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

  const TABS = ['프로필', 'AI', '데이터', '메일', '캘린더', '채팅'] as const
  type Tab = typeof TABS[number]
  const [activeTab, setActiveTab] = useState<Tab>('프로필')

  return (
    <div className="view-canvas flex-1 flex flex-col overflow-hidden">
      {/* 탭 헤더 */}
      <div className="view-header flex shrink-0 gap-1 overflow-x-auto px-4">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSave} className="space-y-5">

          {/* ── 프로필 ── */}
          {activeTab === '프로필' && <>
          <Section title="프로필">
            <Field label="이름" value={form.userName} onChange={v => setField('userName', v)} placeholder="사용자 이름" />
            <div className="space-y-1.5">
              <Field
                label="날씨 도시"
                value={form.weatherCities ?? form.city}
                onChange={v => { setField('weatherCities', v); setField('city', v.split(',')[0].trim()) }}
                placeholder="화성, 서울, 제주"
              />
              <p className="text-xs text-gray-400">쉼표로 구분해 여러 도시를 입력하세요. 한글 도시명 지원 (화성·서울·수원·인천·부산·대구·대전·광주·울산·제주)</p>
            </div>
            <TextArea
              label="매일 하는 일"
              value={form.dailyRoutine}
              onChange={v => setField('dailyRoutine', v)}
              placeholder={'아침 회의 준비\n거래처 확인\n마감 전 관련 종목 점검'}
            />
          </Section>
          </>}

          {/* ── AI ── */}
          {activeTab === 'AI' && <>
          <Section title="Claude.ai 구독 연결">
            <p className="text-xs text-gray-500">API 결제 없이 Claude.ai 구독 계정(Pro/Team)을 그대로 사용합니다.</p>
            <ClaudeWebLoginBlock
              sessionKey={form.claudeSessionKey}
              mcpEndpoint={form.mcpEndpoint}
              onSessionKey={v => setField('claudeSessionKey', v)}
            />
          </Section>
          <Section title="API 키">
            <div className="space-y-1">
              <Field label="Anthropic (Claude)" value={form.anthropicApiKey} onChange={v => setField('anthropicApiKey', v)} type="password" placeholder="sk-ant-..." />
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-500 hover:underline">↗ Anthropic 키 발급 페이지</a>
            </div>
            <div className="space-y-1">
              <Field label="OpenAI (ChatGPT)" value={form.openaiApiKey} onChange={v => setField('openaiApiKey', v)} type="password" placeholder="sk-..." />
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-500 hover:underline">↗ OpenAI 키 발급 페이지</a>
            </div>
          </Section>
          <Section title="Custom AI">
            <p className="text-xs text-gray-500">OpenAI 호환 API 엔드포인트 (Ollama, LM Studio, Open WebUI 등)</p>
            <Field label="엔드포인트" value={form.customAiEndpoint} onChange={v => setField('customAiEndpoint', v)} placeholder="http://localhost:11434/v1" />
            <Field label="모델" value={form.customAiModel} onChange={v => setField('customAiModel', v)} placeholder="llama3, mistral, gpt-4o ..." />
            <LoginToGetKey
              endpoint={form.customAiEndpoint}
              onKey={v => setField('openaiApiKey', v)}
              label="계정+비밀번호로 로그인해서 API Key 가져오기"
            />
          </Section>
          </>}

          {/* ── 데이터 ── */}
          {activeTab === '데이터' && <>
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
          <Section title="주식 · 날씨">
            <Field label="관심 종목" value={form.stockSymbols} onChange={v => setField('stockSymbols', v)} placeholder="AAPL, MSFT, NVDA, 005930.KS" />
            <Field label="OpenWeatherMap API 키" value={form.weatherApiKey} onChange={v => setField('weatherApiKey', v)} type="password" />
            <Field label="Finnhub API 키" value={form.finnhubApiKey} onChange={v => setField('finnhubApiKey', v)} type="password" />
          </Section>
          <Section title="검색 · RSS">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">기본 검색 엔진</label>
              <select
                value={form.searchEngine || 'google'}
                onChange={e => setField('searchEngine', e.target.value as any)}
                className="w-full bg-white border border-surface-border text-gray-700 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="google">Google</option>
                <option value="naver">Naver</option>
                <option value="youtube">YouTube</option>
                <option value="github">GitHub</option>
                <option value="duckduckgo">DuckDuckGo</option>
              </select>
            </div>
            <TextArea
              label="RSS 피드 URL"
              value={form.rssFeeds || ''}
              onChange={v => setField('rssFeeds', v)}
              placeholder={'https://feeds.feedburner.com/...\nhttps://hnrss.org/frontpage\nhttps://techcrunch.com/feed/'}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400">한 줄에 하나씩 RSS/Atom 피드 URL을 입력하세요.</p>
              <button
                type="button"
                onClick={addPopularRssFeeds}
                className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                인기 피드 {POPULAR_RSS_FEEDS.length}개 추가
              </button>
            </div>
          </Section>
          <Section title="설정 파일 가져오기">
            <label className="block">
              <input
                type="file"
                accept="application/json,.json"
                onChange={e => importSettingsFile(e.target.files?.[0])}
                className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </label>
            <p className="text-xs text-gray-500 leading-relaxed">JSON 파일의 설정을 현재 값에 병합합니다.</p>
            {importMessage && <p className="text-xs text-gray-600">{importMessage}</p>}
          </Section>
          <BackupRestoreSection />
          </>}

          {/* ── 메일 ── */}
          {activeTab === '메일' && <>
          <Section title="Gmail 연결">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-800">방법 1 · IMAP (간단)</p>
                <p className="text-xs text-blue-700 leading-relaxed">2단계 인증 ON → 앱 비밀번호 생성 후 추가</p>
                <button type="button"
                  onClick={() => { const id = newId('mail'); setForm(p => ({ ...p, mailAccounts: [...p.mailAccounts, { id, name: 'Gmail (IMAP)', provider: 'imap', imapHost: 'imap.gmail.com', imapPort: 993, imapSsl: true, mcpEndpoint: p.mcpEndpoint, inboxTool: 'imap.inbox', auth: { mode: 'account-password', username: '', password: '' } } as MailAccount] })) }}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
                  Gmail IMAP 추가 →
                </button>
              </div>
              <div className="p-3 bg-gray-50 border border-surface-border rounded-xl space-y-2">
                <p className="text-xs font-semibold text-gray-800">방법 2 · OAuth2</p>
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-500 hover:underline">↗ Google Cloud Console</a>
                {form.mailAccounts.filter(a => a.provider === 'gmail').length === 0
                  ? <button type="button" onClick={() => addMail('gmail')} className="w-full px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs rounded-lg">Gmail OAuth 추가</button>
                  : <div className="space-y-1.5">{form.mailAccounts.filter(a => a.provider === 'gmail').map(account => (<div key={account.id} className="flex items-center justify-between gap-2"><span className="text-xs text-gray-700 truncate">{account.name}</span><GmailConnectButton accountId={account.id} clientId={account.clientId || ''} /></div>))}</div>}
              </div>
            </div>
          </Section>
          <Section title="메일 계정" action={
            <div className="flex gap-1.5">
              <SmallButton onClick={() => addMail('gmail')}>Gmail</SmallButton>
              <SmallButton onClick={() => addMail('naver')}>Naver</SmallButton>
              <SmallButton onClick={() => addMail('imap')}>IMAP</SmallButton>
              <SmallButton onClick={() => addMail('mcp')}>MCP</SmallButton>
            </div>
          }>
            {form.mailAccounts.length === 0 && <SetupText>Gmail 계정을 추가하세요.</SetupText>}
            {form.mailAccounts.map(account => (
              <ConnectionRow key={account.id} onRemove={() => setField('mailAccounts', form.mailAccounts.filter(a => a.id !== account.id))}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="표시 이름" value={account.name} onChange={v => updateMail(account.id, { name: v })} />
                  <Select
                    label="종류"
                    value={account.provider}
                    onChange={v => updateMail(account.id, { provider: v as MailAccount['provider'] })}
                    options={[['gmail', 'Gmail'], ['naver', 'Naver'], ['imap', 'IMAP'], ['mcp', 'MCP']]}
                  />
                </div>

                {(account.provider === 'naver' || account.provider === 'imap') && (
                  <>
                    {account.provider === 'naver' ? (
                      <p className="text-xs text-gray-400">imap.naver.com : 993 (SSL) — Naver 보안 설정에서 IMAP 허용 필요</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Field label="IMAP 호스트" value={account.imapHost || ''} onChange={v => updateMail(account.id, { imapHost: v })} placeholder="imap.example.com" />
                        </div>
                        <Field label="포트" value={String(account.imapPort ?? 993)} onChange={v => updateMail(account.id, { imapPort: parseInt(v) || 993 })} placeholder="993" />
                      </div>
                    )}
                    {account.provider === 'imap' && account.imapHost?.includes('gmail') && (
                      <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs text-amber-700">Gmail은 앱 비밀번호(16자리)를 사용하세요.</p>
                        <button type="button"
                          onClick={() => window.open('https://myaccount.google.com/apppasswords', '_blank', 'noopener,noreferrer')}
                          className="text-xs text-amber-700 underline hover:text-amber-900 shrink-0 ml-2">
                          앱 비밀번호 발급 ↗
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="아이디"
                        value={account.auth?.username || ''}
                        onChange={v => updateMail(account.id, { auth: { mode: 'account-password', username: v, password: account.auth?.password || '' } })}
                        placeholder={account.provider === 'naver' ? 'naver_id (@ 이전)' : 'user@example.com'}
                      />
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-gray-700">비밀번호</span>
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            value={account.auth?.password || ''}
                            onChange={e => updateMail(account.id, { auth: { mode: 'account-password', username: account.auth?.username || '', password: e.target.value } })}
                            placeholder="앱 비밀번호 16자리"
                            className="flex-1 bg-white border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
                          />
                          {account.provider === 'imap' && account.imapHost?.includes('gmail') && (
                            <button type="button"
                              onClick={() => window.open('https://myaccount.google.com/apppasswords', '_blank', 'noopener,noreferrer')}
                              className="shrink-0 px-2 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 hover:bg-amber-100"
                              title="앱 비밀번호 발급 페이지">
                              발급
                            </button>
                          )}
                        </div>
                      </label>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none py-0.5">고급 설정 (MCP 브리지)</summary>
                      <div className="space-y-3 mt-3">
                        <p className="text-xs text-gray-400">MCP 서버가 IMAP 브리지 역할을 합니다. 서버에서 <code className="bg-gray-100 px-1 rounded">imap.inbox</code> tool이 필요합니다.</p>
                        <Field label="MCP 엔드포인트" value={account.mcpEndpoint || ''} onChange={v => updateMail(account.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                        <Field label="IMAP Tool 이름" value={account.inboxTool || ''} onChange={v => updateMail(account.id, { inboxTool: v })} placeholder="imap.inbox" />
                      </div>
                    </details>
                  </>
                )}

                {account.provider === 'mcp' && (
                  <>
                    <Field label="MCP 엔드포인트" value={account.mcpEndpoint || ''} onChange={v => updateMail(account.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                    <McpTestButton endpoint={account.mcpEndpoint || ''} auth={account.auth} />
                    <McpToolField label="받은편지함 Tool" endpoint={account.mcpEndpoint || ''} auth={account.auth} value={account.inboxTool || ''} onChange={v => updateMail(account.id, { inboxTool: v })} defaultPlaceholder="mail.inbox" />
                    <AuthFields auth={account.auth} onChange={auth => updateMail(account.id, { auth })} />
                    <ExtraArgsFields value={account.extraArgs} onChange={extraArgs => updateMail(account.id, { extraArgs })} />
                  </>
                )}

                {account.provider === 'gmail' && (
                  <>
                    <Field label="Gmail OAuth2 Client ID" value={account.clientId || ''} onChange={v => updateMail(account.id, { clientId: v })} placeholder="123456789-xxx.apps.googleusercontent.com" />
                    <GmailConnectButton accountId={account.id} clientId={account.clientId || ''} />
                  </>
                )}
              </ConnectionRow>
            ))}
          </Section>
          </>}

          {/* ── 캘린더 ── */}
          {activeTab === '캘린더' && <>
          <Section title="캘린더 계정" action={<SmallButton onClick={addCalendar}>추가</SmallButton>}>
            {form.calendarAccounts.length === 0 && <SetupText>Google Calendar 계정을 추가하세요.</SetupText>}
            {form.calendarAccounts.map(account => (
              <ConnectionRow key={account.id} onRemove={() => setField('calendarAccounts', form.calendarAccounts.filter(a => a.id !== account.id))}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="표시 이름" value={account.name} onChange={v => updateCalendar(account.id, { name: v })} />
                  <Select label="종류" value={account.provider}
                    onChange={v => updateCalendar(account.id, { provider: v as CalendarAccount['provider'], mcpEndpoint: v === 'mcp' ? account.mcpEndpoint || form.mcpEndpoint : account.mcpEndpoint, eventsTool: v === 'mcp' ? account.eventsTool || 'calendar.events' : account.eventsTool })}
                    options={[['ics', 'Google (ICS URL, 추천)'], ['caldav', 'Google (앱 비밀번호)'], ['mcp', 'MCP'], ['google', 'OAuth2']]} />
                </div>
                {account.provider === 'ics' && (<>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl space-y-1.5">
                    <p className="text-xs font-semibold text-green-800">Google ICS URL 연결 (가장 간단)</p>
                    <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside leading-relaxed">
                      <li>Google Calendar → 설정 (톱니바퀴)</li>
                      <li>왼쪽 내 캘린더 선택 → 아래로 스크롤</li>
                      <li><strong>"비공개 주소 (iCal 형식)"</strong> 옆 복사 버튼</li>
                      <li>아래 입력란에 붙여넣기</li>
                    </ol>
                  </div>
                  <Field label="ICS URL" value={account.icsUrl || ''} onChange={v => updateCalendar(account.id, { icsUrl: v, mcpEndpoint: account.mcpEndpoint || form.mcpEndpoint })} placeholder="https://calendar.google.com/calendar/ical/..." />
                </>)}
                {account.provider === 'caldav' && (() => {
                  const imapMail = form.mailAccounts.find(m => (m.provider === 'imap' || m.provider === 'naver') && m.auth?.mode === 'account-password' && m.auth.username && m.auth.password)
                  return (<>
                    {imapMail ? (
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                        <div><p className="text-xs font-medium text-green-800">메일 앱 비밀번호 자동 연동</p><p className="text-xs text-green-600 mt-0.5">{imapMail.auth?.username} 의 앱 비밀번호를 사용합니다.</p></div>
                        <button type="button" onClick={() => updateCalendar(account.id, { caldavEmail: imapMail.auth?.username || '', caldavPassword: imapMail.auth?.password || '', mcpEndpoint: account.mcpEndpoint || form.mcpEndpoint })} className="text-xs px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shrink-0">적용</button>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl"><p className="text-xs text-amber-700">먼저 메일 계정에 Gmail IMAP + 앱 비밀번호를 추가하면 자동으로 연동됩니다.</p><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 underline">↗ 앱 비밀번호 발급</a></div>
                    )}
                    <Field label="Gmail 주소 (직접 입력)" value={account.caldavEmail || ''} onChange={v => updateCalendar(account.id, { caldavEmail: v, mcpEndpoint: account.mcpEndpoint || form.mcpEndpoint })} placeholder="yourname@gmail.com" />
                    <Field label="앱 비밀번호 (직접 입력)" value={account.caldavPassword || ''} onChange={v => updateCalendar(account.id, { caldavPassword: v })} type="password" placeholder="xxxx xxxx xxxx xxxx" />
                  </>)
                })()}
                {account.provider === 'mcp' && (<>
                  <Field label="MCP 엔드포인트" value={account.mcpEndpoint || ''} onChange={v => updateCalendar(account.id, { mcpEndpoint: v })} placeholder="http://127.0.0.1:8765/mcp" />
                  <McpTestButton endpoint={account.mcpEndpoint || ''} auth={account.auth} />
                  <McpToolField label="일정 Tool" endpoint={account.mcpEndpoint || ''} auth={account.auth} value={account.eventsTool || ''} onChange={v => updateCalendar(account.id, { eventsTool: v })} defaultPlaceholder="calendar.events" />
                  <AuthFields auth={account.auth} onChange={auth => updateCalendar(account.id, { auth })} />
                  <ExtraArgsFields value={account.extraArgs} onChange={extraArgs => updateCalendar(account.id, { extraArgs })} />
                </>)}
                {account.provider === 'google' && (<Field label="Google OAuth2 Client ID" value={account.clientId || ''} onChange={v => updateCalendar(account.id, { clientId: v })} placeholder="123456789-xxx.apps.googleusercontent.com" />)}
              </ConnectionRow>
            ))}
          </Section>
          </>}

          {/* ── 채팅 ── */}
          {activeTab === '채팅' && <>
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
          </>}

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

function ClaudeWebLoginBlock({
  sessionKey,
  mcpEndpoint,
  onSessionKey,
}: {
  sessionKey: string
  mcpEndpoint: string
  onSessionKey: (key: string) => void
}) {
  const [tab, setTab] = useState<'google' | 'email'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionInput, setSessionInput] = useState('')

  async function handleAutoCapture() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const key = await claudeWebCaptureSession(mcpEndpoint)
      onSessionKey(key)
      setSuccess('연결됨! 저장 버튼을 눌러 적용하세요.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const key = await claudeWebLogin(email, password)
      onSessionKey(key)
      setSuccess('연결됨! 저장 버튼을 눌러 적용하세요.')
      setPassword('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSessionKeyApply() {
    if (!sessionInput.trim()) return
    onSessionKey(sessionInput.trim())
    setSuccess('세션 키가 적용됐습니다. 저장 버튼을 눌러 확정하세요.')
    setSessionInput('')
  }

  if (sessionKey) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <div>
            <p className="text-sm font-medium text-green-800">Claude.ai 연결됨</p>
            <p className="text-xs text-green-600 mt-0.5">AI 뷰에서 프로바이더를 "Claude.ai 구독"으로 선택하세요.</p>
          </div>
          <button type="button" onClick={() => { onSessionKey(''); setSuccess('') }}
            className="text-xs text-red-500 hover:text-red-700 shrink-0">연결 해제</button>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-blue-800">💡 안정적인 연결 유지 — Chrome 익스텐션 브릿지</p>
          <p className="text-xs text-blue-700">세션 만료·Cloudflare 차단 없이 <b>Chrome 로그인 상태를 그대로</b> 사용합니다. 한 번 설치하면 영구 유지됩니다.</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Chrome 주소창 → <code className="bg-blue-100 px-1 rounded">chrome://extensions</code></li>
            <li>우측 상단 <b>개발자 모드</b> 켜기</li>
            <li><b>압축해제된 확장 프로그램 로드</b> 클릭</li>
            <li>폴더 선택: <code className="bg-blue-100 px-1 rounded">현재 my-dashboard 폴더\chrome-extension</code></li>
            <li>Claude.ai에 로그인된 상태 유지 → 자동 연결</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 브릿지 안내 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-blue-800">💡 권장 — Chrome 익스텐션 브릿지 (한 번 설치로 영구 사용)</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Chrome 주소창 → <code className="bg-blue-100 px-1 rounded">chrome://extensions</code></li>
          <li>우측 상단 <b>개발자 모드</b> 켜기</li>
          <li><b>압축해제된 확장 프로그램 로드</b> 클릭</li>
          <li>폴더: <code className="bg-blue-100 px-1 rounded">현재 my-dashboard 폴더\chrome-extension</code></li>
          <li>Claude.ai 탭에 로그인 유지 → 자동 연결</li>
        </ol>
      </div>
      <p className="text-xs text-gray-400 text-center">— 또는 아래에서 세션 키 직접 가져오기 —</p>
      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {([['google', 'Google 계정'], ['email', '이메일 계정']] as const).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(''); setSuccess('') }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'google' ? (
        <div className="space-y-3">
          {/* 자동 연결 */}
          <button
            type="button"
            onClick={handleAutoCapture}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                브라우저에서 로그인 중... (최대 2분)
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#fff"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#fff"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#fff"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff"/>
                </svg>
                Google 계정으로 자동 연결
              </>
            )}
          </button>
          {loading && (
            <p className="text-xs text-gray-500 text-center">
              열린 브라우저 창에서 Google로 로그인하면 자동으로 세션 키를 가져옵니다.
            </p>
          )}
          {/* 수동 입력 (대안) */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">직접 세션 키 붙여넣기 (대안)</summary>
            <div className="mt-2 space-y-1.5">
            <div className="flex gap-2">
              <input
                type="password"
                value={sessionInput}
                onChange={e => setSessionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSessionKeyApply()}
                placeholder="sessionKey 값을 여기에 붙여넣기..."
                className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400"
              />
              <button
                type="button"
                onClick={handleSessionKeyApply}
                disabled={!sessionInput.trim()}
                className="px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-xs rounded-xl disabled:opacity-40 font-medium shrink-0"
              >
                적용
              </button>
            </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-700">이메일</span>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-700">비밀번호</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
            </label>
          </div>
          <button type="button" onClick={handleLogin} disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-xl disabled:opacity-50 font-medium">
            {loading ? '로그인 중...' : 'Claude.ai 계정으로 연결'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </div>
  )
}

function GmailConnectButton({ accountId, clientId }: { accountId: string; clientId: string }) {
  const [connected, setConnected] = useState(() => !!getStoredToken(accountId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadGoogleAuth().catch(() => {}) }, [])

  function connect() {
    if (!clientId) { setError('Client ID를 먼저 입력하고 저장하세요.'); return }
    setLoading(true); setError('')
    requestGmailToken(
      clientId,
      (token, exp) => { storeToken(token, exp, accountId); setConnected(true); setLoading(false) },
      err => { setError(err.message); setLoading(false) },
    )
  }

  function disconnect() {
    const token = getStoredToken(accountId)
    if (token) revokeGmailToken(token, accountId)
    else clearGmailToken(accountId)
    setConnected(false)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {connected ? (
        <>
          <span className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />Gmail 연결됨
          </span>
          <button type="button" onClick={disconnect} className="text-xs text-red-500 hover:text-red-700">연결 해제</button>
        </>
      ) : (
        <button type="button" onClick={connect} disabled={loading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg disabled:opacity-50">
          {loading ? '연결 중...' : 'Google 계정 연결'}
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function LoginToGetKey({
  endpoint,
  onKey,
  label = '계정+비밀번호로 API Key 가져오기',
}: {
  endpoint: string
  onKey: (key: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [loginUrl, setLoginUrl] = useState(endpoint)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { setLoginUrl(endpoint) }, [endpoint])

  async function handleLogin() {
    if (!loginUrl || !username || !password) { setError('엔드포인트, 아이디, 비밀번호를 모두 입력하세요.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const key = await fetchApiKeyViaLogin(loginUrl, username, password)
      onKey(key)
      setSuccess('API Key를 가져왔습니다. 저장 버튼을 눌러 적용하세요.')
      setPassword('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
        <span>{open ? '▲' : '▼'}</span> {label}
      </button>
      {open && (
        <div className="space-y-3 p-3 bg-gray-50 border border-surface-border rounded-xl">
          <p className="text-xs text-gray-500">Open WebUI, AnythingLLM, LM Studio 등 자체 서비스에서 로그인 후 토큰을 자동으로 가져옵니다.</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-gray-700">로그인 엔드포인트 (서비스 주소)</span>
            <input type="text" value={loginUrl} onChange={e => setLoginUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-700">이메일 / 아이디</span>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-700">비밀번호</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="button" onClick={handleLogin} disabled={loading}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs rounded-lg disabled:opacity-50">
            {loading ? '로그인 중...' : '로그인 후 API Key 가져오기'}
          </button>
        </div>
      )}
    </div>
  )
}

const BACKUP_KEYS = [
  'dash-settings',
  'dash-notes',
  'dash-todos',
  'dash-journal-entries',
  'dash-journal-analysis',
  'dash-calendar',
  'bookmarks',
  'dashboard-layout',
  'dash-panel-order',
  'mental-avatar-3d-chat',
  'dashboard-ai-chat',
  'dash-show-ai',
  'dash-split-pct',
  'wizard-skipped',
]

const BACKUP_PREFIXES = [
  'dash-dailylog-',
  'dash-snapshot-',
  'dash-activity-',
  'dash-note-html-',
  'briefing-',
  'gmail-token-',
  'gmail-token-expiry-',
  'gcal-token-',
  'gcal-token-expiry-',
  'poll-mail-',
  'poll-chat-',
]

function parseLocalStorageValue(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return raw }
}

function serializeLocalStorageValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function shouldBackupLocalStorageKey(key: string) {
  return BACKUP_KEYS.includes(key) || BACKUP_PREFIXES.some(prefix => key.startsWith(prefix))
}

function collectBackupLocalStorage() {
  const local: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !shouldBackupLocalStorageKey(key)) continue
    const raw = localStorage.getItem(key)
    if (raw !== null) local[key] = parseLocalStorageValue(raw)
  }
  return local
}

function makeRestoreRollback(keys: string[]) {
  const rollback: Record<string, string | null> = {}
  for (const key of keys) rollback[key] = localStorage.getItem(key)
  localStorage.setItem(`dash-restore-rollback-${new Date().toISOString()}`, JSON.stringify(rollback))
}

function listRestoreRollbackKeys() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('dash-restore-rollback-')) keys.push(key)
  }
  return keys.sort((a, b) => b.localeCompare(a))
}

function restoreRollback(key: string) {
  const raw = localStorage.getItem(key)
  if (!raw) return 0
  const snapshot: Record<string, string | null> = JSON.parse(raw)
  const keys = Object.keys(snapshot)
  for (const itemKey of keys) {
    const value = snapshot[itemKey]
    if (value === null) localStorage.removeItem(itemKey)
    else localStorage.setItem(itemKey, value)
  }
  return keys.length
}

function BackupRestoreSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [restoreMsg, setRestoreMsg] = useState('')
  const [rollbackKeys, setRollbackKeys] = useState<string[]>(() => listRestoreRollbackKeys())

  async function handleExport() {
    setStatus('loading')
    setMsg('')
    try {
      const local = collectBackupLocalStorage()
      let kg: unknown = null
      let kgStatus: 'included' | 'unavailable' | 'failed' = 'unavailable'
      const endpoint = 'http://127.0.0.1:8766'
      try {
        const r = await fetch(`${endpoint}/backup`, { signal: AbortSignal.timeout(3000) })
        if (r.ok) {
          kg = await r.json()
          kgStatus = 'included'
        } else {
          kgStatus = 'failed'
        }
      } catch {
        kgStatus = 'unavailable'
      }

      const payload = {
        version: '1.1',
        exportedAt: new Date().toISOString(),
        includedPrefixes: BACKUP_PREFIXES,
        localStorage: local,
        kg,
        kgStatus,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      setStatus('ok')
      setMsg(`백업 완료: localStorage ${Object.keys(local).length}개, KG ${kgStatus === 'included' ? '포함' : '미포함'}`)
    } catch (e: any) {
      setStatus('error')
      setMsg(e.message || '백업 실패')
    }
  }

  async function handleRestore(file: File | undefined) {
    if (!file) return
    setRestoreMsg('')
    try {
      const payload = JSON.parse(await file.text())
      const local: Record<string, unknown> = payload.localStorage || {}

      const keys = Object.keys(local)
      makeRestoreRollback(keys)
      for (const key of keys) {
        localStorage.setItem(key, serializeLocalStorageValue(local[key]))
      }

      // KG 복원 (서버가 /restore 엔드포인트 지원 시)
      let kgRestored = false
      if (payload.kg) {
        try {
          const response = await fetch('http://127.0.0.1:8766/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload.kg),
            signal: AbortSignal.timeout(5000),
          })
          kgRestored = response.ok
        } catch {
          kgRestored = false
        }
      }

      setRestoreMsg(`복원 완료: ${keys.length}개 항목 적용${payload.kg ? (kgRestored ? ', KG 복원 완료' : ', KG 복원 실패/건너뜀') : ''}. 적용 전 상태는 dash-restore-rollback-* 키로 보관했습니다.`)
      setRollbackKeys(listRestoreRollbackKeys())
    } catch {
      setRestoreMsg('복원 실패: 올바른 백업 JSON 파일인지 확인하세요.')
    }
  }

  function handleRestoreLatestRollback() {
    const latest = rollbackKeys[0]
    if (!latest) return
    try {
      const count = restoreRollback(latest)
      setRestoreMsg(`복원 전 상태로 되돌렸습니다: ${count}개 항목 적용. 페이지를 새로고침하세요.`)
    } catch {
      setRestoreMsg('되돌리기 실패: 저장된 rollback 데이터를 읽을 수 없습니다.')
    }
  }

  return (
    <section className="bg-white border border-surface-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">전체 백업 / 복원</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        노트, 할 일, 일지, 캘린더, 북마크, 대시보드 레이아웃, 설정, KG 데이터를 하나의 JSON 파일로 내보내거나 복원합니다.
      </p>

      {/* 내보내기 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors"
        >
          {status === 'loading' ? '내보내는 중...' : '백업 내보내기 (JSON)'}
        </button>
        {status === 'ok' && <span className="text-xs text-green-600">{msg}</span>}
        {status === 'error' && <span className="text-xs text-red-500">{msg}</span>}
      </div>

      {/* 복원 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">백업에서 복원</p>
        <label className="block">
          <input
            type="file"
            accept="application/json,.json"
            onChange={e => handleRestore(e.target.files?.[0])}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </label>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
          복구 방법: 백업 JSON 파일을 선택하면 localStorage와 KG 데이터를 복원합니다. 복원 직전 상태는 자동 보관되며, 문제가 있으면 아래 되돌리기 버튼을 사용할 수 있습니다.
        </div>
        {rollbackKeys.length > 0 && (
          <button
            type="button"
            onClick={handleRestoreLatestRollback}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg"
          >
            최근 복원 전 상태로 되돌리기
          </button>
        )}
        {restoreMsg && (
          <p className={`text-xs ${restoreMsg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>
            {restoreMsg}
          </p>
        )}
        {restoreMsg && !restoreMsg.includes('실패') && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
          >
            지금 새로고침
          </button>
        )}
      </div>
    </section>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
      <code className="flex-1 text-[11px] text-green-400 font-mono break-all">{text}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-[11px] text-gray-400 hover:text-white transition-colors"
      >
        {copied ? '✓ 복사됨' : '복사'}
      </button>
    </div>
  )
}
