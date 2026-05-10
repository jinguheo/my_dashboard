import { useState, useEffect } from 'react'
import type { Settings, View } from '@/types'
import {
  loadGoogleAuth, requestGmailToken, revokeGmailToken,
  getStoredToken, storeToken, clearGmailToken, fetchInbox,
  type EmailMessage,
} from '@/services/gmail'

interface Props {
  settings: Settings
  onNavigate: (v: View) => void
}

export default function Email({ settings, onNavigate }: Props) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    loadGoogleAuth()
      .then(() => setGoogleReady(true))
      .catch(() => setError('Google API 로드에 실패했습니다.'))
  }, [])

  useEffect(() => {
    if (token) loadEmails()
  }, [token])

  async function loadEmails() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setEmails(await fetchInbox(token))
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        setToken(null)
        setError('세션이 만료됐습니다. 다시 연결해주세요.')
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  function handleConnect() {
    if (!settings.gmailClientId) { onNavigate('settings'); return }
    if (!googleReady) { setError('Google API 로드 중입니다. 잠시 후 다시 시도해주세요.'); return }
    setConnecting(true)
    setError(null)
    requestGmailToken(
      settings.gmailClientId,
      (t, exp) => { storeToken(t, exp); setToken(t); setConnecting(false) },
      (err) => { setError(err.message); setConnecting(false) },
    )
  }

  function handleDisconnect() {
    if (token) revokeGmailToken(token)
    else clearGmailToken()
    setToken(null)
    setEmails([])
  }

  const unread = emails.filter(e => !e.isRead).length

  /* ── 미연결 화면 ── */
  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
        <span className="text-5xl">✉</span>
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold text-white">이메일 연결</h2>
          <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
            Gmail을 연결하면 받은 편지함을 대시보드에서 바로 확인할 수 있습니다.
          </p>
        </div>

        {!settings.gmailClientId ? (
          <div className="text-center space-y-3">
            <p className="text-yellow-400 text-sm">먼저 설정에서 Gmail Client ID를 입력해주세요.</p>
            <button
              onClick={() => onNavigate('settings')}
              className="px-5 py-2.5 bg-surface border border-surface-border rounded-xl text-sm text-gray-300 hover:bg-surface-hover transition-colors"
            >
              ⚙ 설정으로 이동
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-white hover:bg-gray-100 text-gray-800 text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {connecting ? (
              <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {connecting ? '연결 중...' : 'Gmail로 연결하기'}
          </button>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center max-w-xs bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="text-xs text-gray-600 text-center max-w-sm space-y-1 mt-2">
          <p>읽기 전용 권한만 요청합니다 (쓰기 권한 없음)</p>
          <p>Google Cloud Console → OAuth2 Client ID 발급 필요</p>
        </div>
      </div>
    )
  }

  /* ── 연결된 받은편지함 ── */
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-surface-border flex items-center gap-2">
        <h1 className="text-sm font-bold text-white">✉ 받은 편지함</h1>
        {unread > 0 && (
          <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-full">{unread}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            연결됨
          </span>
          <button
            onClick={loadEmails}
            disabled={loading}
            className="text-xs px-2.5 py-1 bg-surface hover:bg-surface-hover text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '로딩...' : '새로고침'}
          </button>
          <button
            onClick={handleDisconnect}
            className="text-xs px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
          >
            연결 해제
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
        )}
        {loading && emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">이메일 로딩 중...</div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">받은 편지함이 비어있습니다</div>
        ) : (
          <div className="divide-y divide-surface-border/50">
            {emails.map(email => <EmailRow key={email.id} email={email} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function EmailRow({ email }: { email: EmailMessage }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      onClick={() => setOpen(!open)}
      className={`px-6 py-3.5 cursor-pointer hover:bg-surface transition-colors ${!email.isRead ? 'border-l-2 border-accent' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${email.isRead ? 'bg-transparent' : 'bg-accent'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${email.isRead ? 'text-gray-400' : 'text-white font-semibold'}`}>
              {email.from}
            </span>
            <span className="text-[10px] text-gray-500 shrink-0">{email.date}</span>
          </div>
          <p className={`text-xs mt-0.5 ${email.isRead ? 'text-gray-500' : 'text-gray-300'} ${open ? '' : 'truncate'}`}>
            {email.subject}
          </p>
          <p className={`text-xs text-gray-600 mt-0.5 leading-relaxed ${open ? '' : 'truncate'}`}>
            {email.snippet}
          </p>
        </div>
      </div>
    </div>
  )
}
