declare global {
  interface Window { google: any }
}

import { callMcpTool } from '@/services/mcp'
import type { ConnectionAuth } from '@/types'

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

function tokenKey(accountId?: string) {
  return accountId ? `${TOKEN_KEY}:${accountId}` : TOKEN_KEY
}

function expiryKey(accountId?: string) {
  return accountId ? `${TOKEN_EXPIRY_KEY}:${accountId}` : TOKEN_EXPIRY_KEY
}

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
  // 스크립트 로드 후 window.google.accounts 객체가 실제로 준비될 때까지 대기
  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 5000
    const check = () => {
      if (window.google?.accounts?.oauth2) { resolve(); return }
      if (Date.now() > deadline) { reject(new Error('Google API 초기화 시간 초과')); return }
      setTimeout(check, 50)
    }
    check()
  })
}

export function getStoredToken(accountId?: string): string | null {
  const tKey = tokenKey(accountId)
  const eKey = expiryKey(accountId)
  const expiry = localStorage.getItem(eKey)
  if (expiry && Date.now() > parseInt(expiry)) {
    localStorage.removeItem(tKey)
    localStorage.removeItem(eKey)
    return null
  }
  return localStorage.getItem(tKey)
}

export function storeToken(token: string, expiresIn: number, accountId?: string) {
  localStorage.setItem(tokenKey(accountId), token)
  localStorage.setItem(expiryKey(accountId), String(Date.now() + (expiresIn - 60) * 1000))
}

export function clearGmailToken(accountId?: string) {
  localStorage.removeItem(tokenKey(accountId))
  localStorage.removeItem(expiryKey(accountId))
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
  client.requestAccessToken({ prompt: 'consent select_account' })
}

export function revokeGmailToken(token: string, accountId?: string) {
  window.google?.accounts?.oauth2?.revoke(token, () => {})
  clearGmailToken(accountId)
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

const BATCH_API = 'https://www.googleapis.com/batch/gmail/v1'

function buildBatchBody(ids: string[], boundary: string): string {
  return ids.map((id, i) => [
    `--${boundary}`,
    'Content-Type: application/http',
    `Content-ID: <item${i}>`,
    '',
    `GET /gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date HTTP/1.1`,
    '',
  ].join('\r\n')).join('\r\n') + `\r\n--${boundary}--`
}

function parseBatchResponse(body: string, boundary: string): any[] {
  return body.split(`--${boundary}`)
    .slice(1, -1)
    .map(part => {
      const jsonStart = part.indexOf('{')
      if (jsonStart === -1) return null
      try { return JSON.parse(part.slice(jsonStart)) } catch { return null }
    })
    .filter(Boolean)
}

export async function fetchInbox(token: string, maxResults = 25, accountId?: string): Promise<EmailMessage[]> {
  const hdrs = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(
    `${API}/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: hdrs },
  )
  if (listRes.status === 401) { clearGmailToken(accountId); throw new Error('TOKEN_EXPIRED') }
  if (!listRes.ok) throw new Error('받은편지함 로드 실패')

  const { messages = [] } = await listRes.json()
  const ids: string[] = messages.slice(0, maxResults).map((m: any) => m.id)
  if (!ids.length) return []

  const boundary = `batch_${Date.now()}`
  const batchRes = await fetch(BATCH_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body: buildBatchBody(ids, boundary),
  })

  if (!batchRes.ok) throw new Error('배치 메시지 로드 실패')

  const rawBody = await batchRes.text()
  const contentType = batchRes.headers.get('Content-Type') || ''
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
  const resBoundary = boundaryMatch ? boundaryMatch[1] : boundary

  const msgs = parseBatchResponse(rawBody, resBoundary)

  return msgs.map((msg: any) => {
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
  })
}

export async function fetchInboxFromMcp(
  endpoint: string,
  tool = 'mail.inbox',
  maxResults = 25,
  auth?: ConnectionAuth,
  extraArgs: Record<string, unknown> = {},
): Promise<EmailMessage[]> {
  const result = await callMcpTool<EmailMessage[] | { messages?: EmailMessage[]; emails?: EmailMessage[] }>(
    endpoint,
    tool,
    { ...extraArgs, maxResults },
    auth,
  )
  if (Array.isArray(result)) return result
  return result.messages || result.emails || []
}
