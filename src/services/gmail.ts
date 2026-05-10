declare global {
  interface Window { google: any }
}

export interface EmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  fromEmail: string
  snippet: string
  date: string
  isRead: boolean
}

const TOKEN_KEY = 'gmail-token'
const TOKEN_EXPIRY_KEY = 'gmail-token-expiry'
const API = 'https://gmail.googleapis.com/gmail/v1'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export async function loadGoogleAuth(): Promise<void> {
  await loadScript('https://accounts.google.com/gsi/client')
  await new Promise(r => setTimeout(r, 800))
}

export function getStoredToken(): string | null {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (expiry && Date.now() > parseInt(expiry)) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string, expiresIn: number) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000))
}

export function clearGmailToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

export function requestGmailToken(
  clientId: string,
  onSuccess: (token: string, expiresIn: number) => void,
  onError: (err: Error) => void,
) {
  if (!window.google?.accounts?.oauth2) {
    onError(new Error('Google API가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.'))
    return
  }
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    callback: (res: any) => {
      if (res.error) onError(new Error(res.error_description || res.error))
      else onSuccess(res.access_token, parseInt(res.expires_in))
    },
  })
  client.requestAccessToken({ prompt: '' })
}

export function revokeGmailToken(token: string) {
  window.google?.accounts?.oauth2?.revoke(token, () => {})
  clearGmailToken()
}

function header(hdrs: any[], name: string) {
  return hdrs.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^(.*?)\s*<(.+)>$/)
  if (m) return { name: m[1].replace(/"/g, '').trim() || m[2], email: m[2] }
  return { name: from, email: from }
}

function fmtDate(internalDate: string): string {
  const d = new Date(parseInt(internalDate))
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export async function fetchInbox(token: string, maxResults = 25): Promise<EmailMessage[]> {
  const hdrs = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(
    `${API}/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: hdrs },
  )
  if (listRes.status === 401) { clearGmailToken(); throw new Error('TOKEN_EXPIRED') }
  if (!listRes.ok) throw new Error('받은편지함 로드 실패')

  const { messages = [] } = await listRes.json()

  return Promise.all(
    messages.slice(0, maxResults).map(async (m: any) => {
      const res = await fetch(
        `${API}/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: hdrs },
      )
      const msg = await res.json()
      const hs = msg.payload?.headers || []
      const from = parseFrom(header(hs, 'From'))
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: header(hs, 'Subject') || '(제목 없음)',
        from: from.name,
        fromEmail: from.email,
        snippet: msg.snippet || '',
        date: fmtDate(msg.internalDate),
        isRead: !(msg.labelIds || []).includes('UNREAD'),
      } as EmailMessage
    }),
  )
}
