import { callMcpTool } from '@/services/mcp'
import type { ConnectionAuth } from '@/types'

export interface GCalEvent {
  id: string
  summary: string
  start: string      // ISO datetime or date
  end: string
  location?: string
  description?: string
  colorId?: string
  htmlLink: string
  isAllDay: boolean
}

const TOKEN_KEY  = 'gcal-token'
const EXPIRY_KEY = 'gcal-token-expiry'
const API = 'https://www.googleapis.com/calendar/v3'

function tokenKey(accountId?: string) {
  return accountId ? `${TOKEN_KEY}:${accountId}` : TOKEN_KEY
}

function expiryKey(accountId?: string) {
  return accountId ? `${EXPIRY_KEY}:${accountId}` : EXPIRY_KEY
}

export function getCalendarToken(accountId?: string): string | null {
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

export function storeCalendarToken(token: string, expiresIn: number, accountId?: string) {
  localStorage.setItem(tokenKey(accountId), token)
  localStorage.setItem(expiryKey(accountId), String(Date.now() + (expiresIn - 60) * 1000))
}

export function clearCalendarToken(accountId?: string) {
  localStorage.removeItem(tokenKey(accountId))
  localStorage.removeItem(expiryKey(accountId))
}

export function requestCalendarToken(
  clientId: string,
  onSuccess: (token: string, expiresIn: number) => void,
  onError: (err: Error) => void,
) {
  const w = window as any
  if (!w.google?.accounts?.oauth2) {
    onError(new Error('Google API가 로드되지 않았습니다.'))
    return
  }
  const client = w.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    callback: (res: any) => {
      if (res.error) onError(new Error(res.error_description || res.error))
      else onSuccess(res.access_token, parseInt(res.expires_in))
    },
  })
  client.requestAccessToken({ prompt: 'consent select_account' })
}

export function revokeCalendarToken(token: string, accountId?: string) {
  const w = window as any
  w.google?.accounts?.oauth2?.revoke(token, () => {})
  clearCalendarToken(accountId)
}

function parseEventDate(e: any): { start: string; isAllDay: boolean } {
  if (e.start?.date) return { start: e.start.date, isAllDay: true }
  if (e.start?.dateTime) return { start: e.start.dateTime, isAllDay: false }
  return { start: '', isAllDay: false }
}

export async function fetchGCalEvents(token: string, days = 30, accountId?: string): Promise<GCalEvent[]> {
  const now = new Date()
  const future = new Date(now.getTime() + days * 86400000)
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const res = await fetch(`${API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) { clearCalendarToken(accountId); throw new Error('TOKEN_EXPIRED') }
  if (!res.ok) throw new Error('Google Calendar 로드 실패')

  const data = await res.json()
  return (data.items || []).map((item: any): GCalEvent => {
    const { start, isAllDay } = parseEventDate(item)
    const endRaw = item.end?.date || item.end?.dateTime || ''
    return {
      id: item.id,
      summary: item.summary || '(제목 없음)',
      start,
      end: endRaw,
      location: item.location,
      description: item.description,
      colorId: item.colorId,
      htmlLink: item.htmlLink,
      isAllDay,
    }
  })
}

export function gcalDateStr(event: GCalEvent): string {
  const raw = event.start
  if (!raw) return ''
  if (event.isAllDay) return raw    // YYYY-MM-DD
  return raw.split('T')[0]          // ISO → YYYY-MM-DD
}

export function gcalTimeStr(event: GCalEvent): string {
  if (event.isAllDay) return '종일'
  const d = new Date(event.start)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const GCAL_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
}
export function gcalColor(colorId?: string): string {
  return colorId ? (GCAL_COLORS[colorId] || '#7c3aed') : '#4285F4'
}

export async function fetchGCalEventsFromMcp(
  endpoint: string,
  tool = 'calendar.events',
  days = 60,
  auth?: ConnectionAuth,
  extraArgs: Record<string, unknown> = {},
): Promise<GCalEvent[]> {
  const result = await callMcpTool<GCalEvent[] | { events?: GCalEvent[] }>(endpoint, tool, { ...extraArgs, days }, auth)
  if (Array.isArray(result)) return result
  return result.events || []
}
