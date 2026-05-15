import { useEffect, useMemo, useState } from 'react'
import type { CalendarAccount } from '@/types'
import type { CalendarState } from '@/store/useCalendar'
import { loadGoogleAuth } from '@/services/gmail'
import {
  getCalendarToken, storeCalendarToken,
  requestCalendarToken, revokeCalendarToken,
  fetchGCalEvents, fetchGCalEventsFromMcp, gcalDateStr, gcalTimeStr, gcalColor,
  type GCalEvent,
} from '@/services/googleCalendar'
import type { Settings } from '@/types'

interface Props {
  calendar: CalendarState
  settings: Settings
}

type AccountEvent = GCalEvent & { accountId: string; accountName: string }

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#111827', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']

function calDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = Array(first).fill(null)
  for (let i = 1; i <= total; i++) days.push(i)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Calendar({ calendar, settings }: Props) {
  const today = new Date()
  const accounts = settings.calendarAccounts
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(today.toISOString().split('T')[0])
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '')
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId],
  )

  const [tokens, setTokens] = useState<Record<string, boolean>>({})
  const [gcalEvents, setGcalEvents] = useState<AccountEvent[]>([])
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalError, setGcalError] = useState<string | null>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    loadGoogleAuth().then(() => setGoogleReady(true)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccountId(accounts[0].id)
    refreshTokenState()
    loadAllGcal()
  }, [accounts])

  function refreshTokenState() {
    setTokens(Object.fromEntries(accounts.map(a => [a.id, a.provider === 'mcp' ? !!a.mcpEndpoint : !!getCalendarToken(a.id)])))
  }

  async function loadAllGcal() {
    setGcalLoading(true)
    setGcalError(null)
    try {
      const loaded = await Promise.all(accounts.map(async account => {
        let events: GCalEvent[] = []
        if (account.provider === 'mcp') {
          if (!account.mcpEndpoint) return []
          events = await fetchGCalEventsFromMcp(account.mcpEndpoint, account.eventsTool || 'calendar.events', 60, account.auth, account.extraArgs)
        } else {
          const token = getCalendarToken(account.id)
          if (!token) return []
          events = await fetchGCalEvents(token, 60, account.id)
        }
        return events.map(e => ({ ...e, accountId: account.id, accountName: account.name || 'Google Calendar' }))
      }))
      setGcalEvents(loaded.flat())
      refreshTokenState()
    } catch (e: any) {
      setGcalError(e.message)
      refreshTokenState()
    }
    setGcalLoading(false)
  }

  function handleGcalConnect(account: CalendarAccount | undefined) {
    if (!account) return
    if (account.provider === 'mcp') { loadAllGcal(); return }
    if (!account.clientId) { setGcalError('설정에서 Google Client ID를 먼저 입력해주세요.'); return }
    if (!googleReady) { setGcalError('Google API loading. Try again shortly.'); return }
    setConnecting(true)
    requestCalendarToken(
      account.clientId,
      (t, exp) => {
        storeCalendarToken(t, exp, account.id)
        setConnecting(false)
        loadAllGcal()
      },
      err => { setGcalError(err.message); setConnecting(false) },
    )
  }

  function handleGcalDisconnect(account: CalendarAccount | undefined) {
    if (!account) return
    if (account.provider === 'mcp') {
      setGcalEvents(p => p.filter(e => e.accountId !== account.id))
      refreshTokenState()
      return
    }
    const token = getCalendarToken(account.id)
    if (token) revokeCalendarToken(token, account.id)
    setGcalEvents(p => p.filter(e => e.accountId !== account.id))
    refreshTokenState()
  }

  const todayStr = today.toISOString().split('T')[0]
  const days = calDays(year, month)
  const localEvts = calendar.forDate(selected)
  const gcalEvtsForDay = gcalEvents.filter(e => gcalDateStr(e) === selected)

  function hasEvent(dateStr: string) {
    return calendar.forDate(dateStr).length > 0 || gcalEvents.some(e => gcalDateStr(e) === dateStr)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    calendar.add(title, selected, time || undefined, color)
    setTitle('')
    setTime('')
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white border border-surface-border rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedAccount?.id || ''}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="flex-1 bg-white border border-surface-border text-gray-700 text-xs rounded-lg px-2.5 py-2 outline-none"
              >
                {accounts.length === 0 && <option value="">계정 없음</option>}
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name || 'Google Calendar'}</option>)}
              </select>
              <button onClick={loadAllGcal} disabled={gcalLoading} className="text-xs px-2.5 py-2 bg-surface border border-surface-border hover:bg-surface-hover text-gray-700 rounded-lg disabled:opacity-50">
                {gcalLoading ? '로딩...' : '새로고침'}
              </button>
            </div>
            {selectedAccount && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${tokens[selectedAccount.id] ? 'text-green-600' : 'text-gray-400'}`}>
                  {tokens[selectedAccount.id] ? '연결됨' : '연결 안 됨'}
                </span>
                {tokens[selectedAccount.id] && selectedAccount.provider !== 'mcp' ? (
                  <button onClick={() => handleGcalDisconnect(selectedAccount)} className="text-xs text-red-500 hover:text-red-700">연결 해제</button>
                ) : (
                  <button onClick={() => handleGcalConnect(selectedAccount)} disabled={connecting} className="text-xs px-2.5 py-1 bg-[#4285F4] hover:bg-[#3367d6] text-white rounded-lg disabled:opacity-50">
                    {connecting ? '연결 중...' : selectedAccount.provider === 'mcp' ? 'MCP 조회' : '연결하기'}
                  </button>
                )}
              </div>
            )}
          </div>
          {gcalError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{gcalError}</p>}

          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover text-gray-500 hover:text-gray-900">‹</button>
            <h2 className="text-base font-bold text-gray-900">{year}년 {month + 1}월</h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover text-gray-500 hover:text-gray-900">›</button>
          </div>

          <div className="grid grid-cols-7">
            {DAYS.map((d, i) => <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = toDateStr(year, month, day)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selected
              const isSun = i % 7 === 0
              const isSat = i % 7 === 6
              return (
                <button
                  key={day}
                  onClick={() => setSelected(dateStr)}
                  className={`relative flex flex-col items-center py-2 rounded-lg text-sm transition-all ${
                    isSelected ? 'bg-gray-900 text-white' : isToday ? 'bg-gray-100 text-gray-900 font-semibold' : 'hover:bg-surface text-gray-700'
                  } ${!isSelected && isSun ? 'text-red-500' : ''} ${!isSelected && isSat ? 'text-blue-500' : ''}`}
                >
                  {day}
                  {hasEvent(dateStr) && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="w-72 shrink-0 bg-gray-50 border-l border-surface-border flex flex-col">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-gray-900">{selected}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{localEvts.length + gcalEvtsForDay.length}개의 일정</p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {gcalEvtsForDay.map(e => (
            <a key={`${e.accountId}-${e.id}`} href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 bg-white border border-surface-border rounded-lg p-2.5 hover:bg-surface-hover group">
              <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: gcalColor(e.colorId) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">{e.accountName}</p>
                <p className="text-xs text-gray-800 font-medium line-clamp-2">{e.summary}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{gcalTimeStr(e)}</p>
              </div>
            </a>
          ))}

          {localEvts.map(e => (
            <div key={e.id} className="flex items-start gap-2 bg-white border border-surface-border rounded-lg p-2.5 group">
              <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: e.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 font-medium">{e.title}</p>
                {e.time && <p className="text-[10px] text-gray-400">{e.time}</p>}
              </div>
              <button onClick={() => calendar.remove(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm">x</button>
            </div>
          ))}

          {localEvts.length === 0 && gcalEvtsForDay.length === 0 && <p className="text-xs text-gray-400 text-center mt-4">일정이 없습니다.</p>}
        </div>

        <form onSubmit={handleAdd} className="p-3 border-t border-surface-border space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 추가..." className="w-full bg-white border border-surface-border rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-gray-400" />
          <div className="flex gap-2">
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="flex-1 bg-white border border-surface-border rounded-lg px-2 py-1.5 text-xs text-gray-700 outline-none" />
            <div className="flex gap-1">
              {COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border-2 ${color === c ? 'scale-125 border-gray-400' : 'border-transparent'}`} style={{ background: c }} />)}
            </div>
          </div>
          <button type="submit" className="w-full py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs rounded-lg">추가</button>
        </form>
      </div>
    </div>
  )
}
