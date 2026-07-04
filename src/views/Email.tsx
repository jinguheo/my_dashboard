import { useEffect, useMemo, useState } from 'react'
import type { MailAccount, Settings, View } from '@/types'
import {
  loadGoogleAuth, requestGmailToken, revokeGmailToken,
  getStoredToken, storeToken, clearGmailToken, fetchInbox, fetchInboxFromMcp,
  type EmailMessage,
} from '@/services/gmail'

interface Props {
  settings: Settings
  onNavigate: (v: View) => void
}

export default function Email({ settings, onNavigate }: Props) {
  const accounts = settings.mailAccounts
  const [selectedId, setSelectedId] = useState(accounts[0]?.id || '')
  const selected = useMemo(
    () => accounts.find(a => a.id === selectedId) || accounts[0],
    [accounts, selectedId],
  )
  const [token, setToken] = useState<string | null>(() => selected?.provider === 'gmail' ? getStoredToken(selected.id) : null)
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    loadGoogleAuth()
      .then(() => setGoogleReady(true))
      .catch(() => setError('Google API load failed.'))
  }, [])

  useEffect(() => {
    if (!selected && accounts.length > 0) setSelectedId(accounts[0].id)
  }, [accounts, selected])

  useEffect(() => {
    if (!selected) return
    if (selected.provider === 'mcp') {
      setToken('mcp')
      setEmails([])
      loadEmails(selected, 'mcp')
      return
    }
    if (selected.provider === 'naver' || selected.provider === 'imap') {
      const hasCredentials = !!(selected.auth?.username && selected.auth?.password)
      setToken(hasCredentials ? selected.provider : null)
      setEmails([])
      if (hasCredentials) loadEmails(selected, selected.provider)
      return
    }
    const nextToken = getStoredToken(selected.id)
    setToken(nextToken)
    setEmails([])
    if (nextToken) loadEmails(selected, nextToken)
  }, [selected?.id])

  async function loadEmails(account = selected, activeToken = token) {
    if (!account || !activeToken) return
    setLoading(true)
    setError(null)
    try {
      if (account.provider === 'mcp') {
        if (!account.mcpEndpoint) throw new Error('MCP endpoint is required.')
        setEmails(await fetchInboxFromMcp(account.mcpEndpoint, account.inboxTool || 'mail.inbox', 25, account.auth, account.extraArgs))
      } else if (account.provider === 'naver' || account.provider === 'imap') {
        const endpoint = account.mcpEndpoint || settings.mcpEndpoint
        if (!endpoint) throw new Error('MCP 브리지 엔드포인트를 설정해주세요.')
        const imapArgs = {
          host: account.imapHost || (account.provider === 'naver' ? 'imap.naver.com' : ''),
          port: account.imapPort ?? 993,
          ssl: account.imapSsl ?? true,
          username: account.auth?.username,
          password: account.auth?.password,
          ...(account.extraArgs || {}),
        }
        setEmails(await fetchInboxFromMcp(endpoint, account.inboxTool || 'imap.inbox', 25, undefined, imapArgs))
      } else {
        setEmails(await fetchInbox(activeToken, 25, account.id))
      }
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        setToken(null)
        setError('세션이 만료되었습니다. 다시 연결해주세요.')
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  function handleConnect() {
    if (!selected) return
    if (selected.provider === 'mcp') { loadEmails(selected, 'mcp'); return }
    if (selected.provider === 'naver' || selected.provider === 'imap') {
      if (!selected.auth?.username || !selected.auth?.password) { onNavigate('settings'); return }
      setToken(selected.provider)
      loadEmails(selected, selected.provider)
      return
    }
    if (!selected.clientId) { onNavigate('settings'); return }
    if (!googleReady) { setError('Google API loading. Try again shortly.'); return }
    setConnecting(true)
    setError(null)
    requestGmailToken(
      selected.clientId,
      (t, exp) => {
        storeToken(t, exp, selected.id)
        setToken(t)
        setConnecting(false)
        loadEmails(selected, t)
      },
      err => { setError(err.message); setConnecting(false) },
    )
  }

  function handleDisconnect() {
    if (!selected) return
    if (selected.provider === 'mcp') { setToken(null); setEmails([]); return }
    if (token) revokeGmailToken(token, selected.id)
    else clearGmailToken(selected.id)
    setToken(null)
    setEmails([])
  }

  if (accounts.length === 0) {
    return <ConnectPrompt title="메일 계정 없음" body="설정에서 Gmail 계정을 하나 이상 추가하세요." onNavigate={onNavigate} />
  }

  const unread = emails.filter(e => !e.isRead).length

  return (
    <div className="view-canvas flex flex-1 flex-col overflow-hidden">
      <div className="view-header flex items-center gap-2 px-4 py-3 sm:px-6">
        <h1 className="text-sm font-bold text-gray-900">받은 편지함</h1>
        {unread > 0 && <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[10px] font-bold rounded-full">{unread}</span>}
        <select
          value={selected?.id || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="ml-3 bg-white border border-surface-border text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none"
        >
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name || 'Gmail'}</option>)}
        </select>
        <button onClick={() => onNavigate('settings')} className="text-xs text-gray-400 hover:text-gray-700">계정 관리</button>
        <div className="ml-auto flex items-center gap-2">
          {token ? (
            <>
              <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />연결됨</span>
              <button onClick={() => loadEmails()} disabled={loading} className="text-xs px-2.5 py-1 bg-surface border border-surface-border hover:bg-surface-hover text-gray-700 rounded-lg disabled:opacity-50">
                {loading ? '로딩...' : '새로고침'}
              </button>
              <button onClick={handleDisconnect} className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-lg">
                연결 해제
              </button>
            </>
          ) : (
            <button onClick={handleConnect} disabled={connecting} className="text-xs px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white font-medium rounded-lg disabled:opacity-60">
              {connecting ? '연결 중...' :
                selected?.provider === 'mcp' ? 'MCP 조회' :
                selected?.provider === 'naver' ? 'Naver 조회' :
                selected?.provider === 'imap' ? 'IMAP 조회' :
                'Gmail 연결'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-500">{error}</div>}
        {!token ? (
          <ConnectPrompt
            title={`${selected?.name || 'Gmail'} 연결`}
            body={
              selected?.provider === 'naver' || selected?.provider === 'imap'
                ? '설정에서 아이디와 비밀번호를 입력한 후 다시 시도하세요.'
                : '이 계정의 받은 편지함을 보려면 연결하세요.'
            }
            onNavigate={onNavigate}
            inline
          />
        ) : loading && emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">메일 로딩 중...</div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">받은 편지함이 비어 있습니다.</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {emails.map(email => <EmailRow key={email.id} email={email} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectPrompt({ title, body, onNavigate, inline = false }: {
  title: string
  body: string
  onNavigate: (v: View) => void
  inline?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 p-8 ${inline ? 'h-64' : 'flex-1'}`}>
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-red-500 text-sm max-w-xs leading-relaxed">{body}</p>
      </div>
      <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm">
        설정으로 이동
      </button>
    </div>
  )
}

function EmailRow({ email }: { email: EmailMessage }) {
  const [open, setOpen] = useState(false)
  return (
    <div onClick={() => setOpen(!open)} className={`px-6 py-3.5 cursor-pointer hover:bg-surface-hover ${!email.isRead ? 'border-l-2 border-gray-900' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${email.isRead ? 'bg-transparent' : 'bg-gray-900'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${email.isRead ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}>{email.from}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{email.date}</span>
          </div>
          <p className={`text-xs mt-0.5 ${email.isRead ? 'text-gray-400' : 'text-gray-700'} ${open ? '' : 'truncate'}`}>{email.subject}</p>
          <p className={`text-xs text-gray-400 mt-0.5 leading-relaxed ${open ? '' : 'truncate'}`}>{email.snippet}</p>
        </div>
      </div>
    </div>
  )
}
