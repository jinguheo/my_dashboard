import { useEffect, useMemo, useState } from 'react'
import type { CalendarAccount } from '@/types'
import type { CalendarState } from '@/store/useCalendar'
import { loadGoogleAuth } from '@/services/gmail'
import {
  getCalendarToken, storeCalendarToken,
  requestCalendarToken, revokeCalendarToken,
  fetchGCalEvents, fetchGCalEventsFromMcp, fetchCalDavEvents, fetchIcsEvents, gcalDateStr, gcalTimeStr, gcalColor,
  type GCalEvent,
} from '@/services/googleCalendar'
import type { Settings } from '@/types'
import { getLunarDateStr, getLunarDateFull, getKoreanHoliday } from '@/utils/koreanCalendar'

interface Props {
  calendar: CalendarState
  settings: Settings
}

type AccountEvent = GCalEvent & { accountId: string; accountName: string }

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#111827', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']

const HOLIDAY_SHORT: Record<string, string> = {
  '부처님오신날': '부처님날',
  '설 전날': '설전날',
  '설 다음날': '설다음',
  '추석 전날': '추석전',
  '추석 다음날': '추석후',
  '설날 대체공휴일': '설대체',
  '추석 대체공휴일': '추석대체',
  '국회의원선거': '총선',
  '대통령선거': '대선',
  '지방선거': '지선',
  '신정 대체공휴일': '신정대체',
  '삼일절 대체공휴일': '삼일대체',
  '어린이날 대체공휴일': '어린이대체',
  '현충일 대체공휴일': '현충대체',
  '광복절 대체공휴일': '광복대체',
  '개천절 대체공휴일': '개천대체',
  '한글날 대체공휴일': '한글대체',
  '성탄절 대체공휴일': '성탄대체',
}
function shortHoliday(name: string) { return HOLIDAY_SHORT[name] ?? name }

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
    setTokens(Object.fromEntries(accounts.map(a =>
      [a.id, a.provider === 'mcp' ? !!a.mcpEndpoint
        : a.provider === 'caldav' ? !!(a.caldavEmail && a.caldavPassword)
        : a.provider === 'ics' ? !!a.icsUrl
        : !!getCalendarToken(a.id)]
    )))
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
        } else if (account.provider === 'ics') {
          if (!account.icsUrl) return []
          const endpoint = account.mcpEndpoint || settings.mcpEndpoint || 'http://127.0.0.1:8765/mcp'
          events = await fetchIcsEvents(endpoint, account.icsUrl, 60)
        } else if (account.provider === 'caldav') {
          // 자체 credentials 없으면 IMAP Gmail 계정에서 자동으로 가져옴
          const imapGmail = settings.mailAccounts?.find(
            m => (m.provider === 'imap' || m.provider === 'naver') &&
              m.auth?.mode === 'account-password' && m.auth.username && m.auth.password
          )
          const email = account.caldavEmail || imapGmail?.auth?.username || ''
          const password = account.caldavPassword || imapGmail?.auth?.password || ''
          if (!email || !password) return []
          const endpoint = account.mcpEndpoint || settings.mcpEndpoint || 'http://127.0.0.1:8765/mcp'
          events = await fetchCalDavEvents(endpoint, email, password, 60)
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
    if (account.provider === 'mcp' || account.provider === 'caldav' || account.provider === 'ics') { loadAllGcal(); return }
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

  const [selY, selM, selD] = selected.split('-').map(Number)
  const selectedLunar = getLunarDateFull(selY, selM, selD)
  const selectedHoliday = getKoreanHoliday(selected)

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
    <div className="view-canvas flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="view-panel space-y-3 p-3">
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
                {(selectedAccount.provider === 'caldav' || selectedAccount.provider === 'ics' || selectedAccount.provider === 'mcp') ? (
                  <button onClick={() => handleGcalConnect(selectedAccount)} disabled={gcalLoading} className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                    {gcalLoading ? '조회 중...' : selectedAccount.provider === 'ics' ? 'ICS 조회' : selectedAccount.provider === 'caldav' ? 'CalDAV 조회' : 'MCP 조회'}
                  </button>
                ) : tokens[selectedAccount.id] ? (
                  <button onClick={() => handleGcalDisconnect(selectedAccount)} className="text-xs text-red-500 hover:text-red-700">연결 해제</button>
                ) : (
                  <button onClick={() => handleGcalConnect(selectedAccount)} disabled={connecting} className="text-xs px-2.5 py-1 bg-[#4285F4] hover:bg-[#3367d6] text-white rounded-lg disabled:opacity-50">
                    {connecting ? '연결 중...' : '연결하기'}
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
              const holiday = getKoreanHoliday(dateStr)
              const lunar = getLunarDateStr(year, month + 1, day)
              const isRed = isSun || !!holiday
              const textColor = isSelected ? '' : isRed ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'
              return (
                <button
                  key={day}
                  onClick={() => setSelected(dateStr)}
                  className={`relative flex flex-col items-center pt-1.5 pb-2 rounded-lg text-sm transition-all ${textColor} ${
                    isSelected ? 'bg-gray-900 text-white' : isToday ? 'bg-gray-100 font-semibold' : 'hover:bg-surface'
                  }`}
                >
                  <span className="leading-none">{day}</span>
                  {lunar && <span className={`text-[9px] leading-none mt-0.5 ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>{lunar}</span>}
                  {holiday && <span className={`text-[8px] leading-none mt-0.5 truncate w-full text-center px-0.5 ${isSelected ? 'text-red-300' : 'text-red-500'}`}>{shortHoliday(holiday)}</span>}
                  {hasEvent(dateStr) && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="w-72 shrink-0 bg-gray-50 border-l border-surface-border flex flex-col">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-gray-900">{selected}</h3>
          {selectedLunar && <p className="text-xs text-gray-500 mt-0.5">{selectedLunar}</p>}
          {selectedHoliday && <p className="text-xs text-red-500 mt-0.5">{selectedHoliday}</p>}
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
