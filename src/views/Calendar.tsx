import { useState, useEffect } from 'react'
import type { CalendarState } from '@/store/useCalendar'
import type { Settings } from '@/types'
import { loadGoogleAuth } from '@/services/gmail'
import {
  getCalendarToken, storeCalendarToken,
  requestCalendarToken, revokeCalendarToken,
  fetchGCalEvents, gcalDateStr, gcalTimeStr, gcalColor,
  type GCalEvent,
} from '@/services/googleCalendar'

interface Props {
  calendar: CalendarState
  settings: Settings
}

const DAYS  = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']

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
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(today.toISOString().split('T')[0])
  const [title, setTitle] = useState('')
  const [time, setTime]   = useState('')
  const [color, setColor] = useState(COLORS[0])

  // Google Calendar
  const [gcalToken, setGcalToken]   = useState<string | null>(() => getCalendarToken())
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([])
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalError, setGcalError]   = useState<string | null>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    loadGoogleAuth().then(() => setGoogleReady(true)).catch(() => {})
  }, [])

  useEffect(() => {
    if (gcalToken) loadGcal()
  }, [gcalToken])

  async function loadGcal() {
    if (!gcalToken) return
    setGcalLoading(true)
    setGcalError(null)
    try {
      setGcalEvents(await fetchGCalEvents(gcalToken, 60))
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') { setGcalToken(null); setGcalError('세션 만료 – 다시 연결해주세요.') }
      else setGcalError(e.message)
    }
    setGcalLoading(false)
  }

  function handleGcalConnect() {
    if (!settings.gmailClientId) { setGcalError('설정에서 Google Client ID를 먼저 입력해주세요.'); return }
    if (!googleReady) { setGcalError('Google API 로드 중입니다. 잠시 후 다시 시도해주세요.'); return }
    setConnecting(true)
    requestCalendarToken(
      settings.gmailClientId,
      (t, exp) => { storeCalendarToken(t, exp); setGcalToken(t); setConnecting(false) },
      (err) => { setGcalError(err.message); setConnecting(false) },
    )
  }

  function handleGcalDisconnect() {
    if (gcalToken) revokeCalendarToken(gcalToken)
    setGcalToken(null)
    setGcalEvents([])
  }

  const todayStr = today.toISOString().split('T')[0]
  const days = calDays(year, month)

  // 선택된 날짜의 이벤트 (로컬 + GCal)
  const localEvts = calendar.forDate(selected)
  const gcalEvtsForDay = gcalEvents.filter(e => gcalDateStr(e) === selected)

  // 날짜에 이벤트 있는지 체크
  function hasEvent(dateStr: string) {
    return calendar.forDate(dateStr).length > 0
      || gcalEvents.some(e => gcalDateStr(e) === dateStr)
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
      {/* 달력 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Google Calendar 연결 바 */}
          <div className="flex items-center justify-between bg-surface rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
                <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5"/>
                <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-xs text-gray-300 font-medium">Google Calendar</span>
              {gcalToken && <span className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"/>연결됨</span>}
            </div>
            <div className="flex items-center gap-2">
              {gcalToken ? (
                <>
                  <button onClick={loadGcal} disabled={gcalLoading} className="text-[10px] text-gray-500 hover:text-accent transition-colors disabled:opacity-50">
                    {gcalLoading ? '로딩...' : '새로고침'}
                  </button>
                  <button onClick={handleGcalDisconnect} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
                    연결 해제
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGcalConnect}
                  disabled={connecting}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 bg-[#4285F4] hover:bg-[#3367d6] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {connecting ? '연결 중...' : '연결하기'}
                </button>
              )}
            </div>
          </div>
          {gcalError && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{gcalError}</p>}

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover text-gray-400 hover:text-white transition-colors">‹</button>
            <h2 className="text-base font-bold text-white">{year}년 {month + 1}월</h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover text-gray-400 hover:text-white transition-colors">›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAYS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = toDateStr(year, month, day)
              const isToday    = dateStr === todayStr
              const isSelected = dateStr === selected
              const isSun = i % 7 === 0
              const isSat = i % 7 === 6

              return (
                <button
                  key={day}
                  onClick={() => setSelected(dateStr)}
                  className={`
                    relative flex flex-col items-center py-2 rounded-lg transition-all text-sm
                    ${isSelected ? 'bg-accent text-white' : isToday ? 'bg-accent/20 text-accent-light' : 'hover:bg-surface text-gray-300'}
                    ${!isSelected && isSun ? 'text-red-400' : ''}
                    ${!isSelected && isSat ? 'text-blue-400' : ''}
                  `}
                >
                  {day}
                  {hasEvent(dateStr) && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-accent-light'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 이벤트 사이드바 */}
      <div className="w-72 shrink-0 bg-[#0d0d1a] border-l border-surface-border flex flex-col">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-white">{selected}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{localEvts.length + gcalEvtsForDay.length}개의 일정</p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {/* Google Calendar 이벤트 */}
          {gcalEvtsForDay.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1">Google Calendar</p>
              {gcalEvtsForDay.map(e => (
                <a
                  key={e.id}
                  href={e.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 bg-surface rounded-lg p-2.5 hover:bg-surface-hover transition-colors group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: gcalColor(e.colorId) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 font-medium line-clamp-2">{e.summary}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{gcalTimeStr(e)}</p>
                    {e.location && <p className="text-[10px] text-gray-600 truncate">{e.location}</p>}
                  </div>
                  <span className="text-gray-600 group-hover:text-gray-400 text-[10px] shrink-0">↗</span>
                </a>
              ))}
            </div>
          )}

          {/* 로컬 이벤트 */}
          {localEvts.length > 0 && (
            <div className="space-y-1.5">
              {gcalEvtsForDay.length > 0 && (
                <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1">내 일정</p>
              )}
              {localEvts.map(e => (
                <div key={e.id} className="flex items-start gap-2 bg-surface rounded-lg p-2.5 group">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 font-medium">{e.title}</p>
                    {e.time && <p className="text-[10px] text-gray-500">{e.time}</p>}
                  </div>
                  <button
                    onClick={() => calendar.remove(e.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-sm transition-all"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {localEvts.length === 0 && gcalEvtsForDay.length === 0 && (
            <p className="text-xs text-gray-600 text-center mt-4">일정이 없습니다</p>
          )}
        </div>

        {/* 로컬 이벤트 추가 */}
        <form onSubmit={handleAdd} className="p-3 border-t border-surface-border space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="일정 추가..."
            className="w-full bg-surface rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="flex-1 bg-surface rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none"
            />
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full transition-transform ${color === c ? 'scale-125' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-1.5 bg-accent hover:bg-accent-hover text-white text-xs rounded-lg transition-colors">
            추가
          </button>
        </form>
      </div>
    </div>
  )
}
