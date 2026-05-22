import KoreanLunarCalendar from 'korean-lunar-calendar'

// 양력 고정 공휴일
const SOLAR_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
}

// 선거일 (공직선거법에 따른 공휴일)
const ELECTION_DAYS: Record<string, string> = {
  '2020-04-15': '국회의원선거',
  '2022-03-09': '대통령선거',
  '2022-06-01': '지방선거',
  '2024-04-10': '국회의원선거',
  '2026-06-03': '지방선거',
  '2028-04-12': '국회의원선거',
}

// 음력 기반 공휴일
const LUNAR_HOLIDAY_DEFS = [
  { key: 'seollal', month: 1, day: 1, offsets: [-1, 0, 1], names: ['설 전날', '설날', '설 다음날'] },
  { key: 'buddha', month: 4, day: 8, offsets: [0], names: ['부처님오신날'] },
  { key: 'chuseok', month: 8, day: 15, offsets: [-1, 0, 1], names: ['추석 전날', '추석', '추석 다음날'] },
]

const SEOLLAL_NAMES = new Set(['설 전날', '설날', '설 다음날'])
const CHUSEOK_NAMES = new Set(['추석 전날', '추석', '추석 다음날'])
const PERIOD_NAMES = new Set([...SEOLLAL_NAMES, ...CHUSEOK_NAMES])

const holidayCache = new Map<number, Map<string, string>>()

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function offsetDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toStr(d)
}

// 대체공휴일 계산 (2022년 개정 공휴일에 관한 법률 기준)
function addSubstituteHolidays(
  map: Map<string, string>,
  seollalBase: string | null,
  chuseokBase: string | null,
): void {
  // 설날/추석 3일 연휴 중 일요일 또는 타 공휴일과 겹치면 연휴 다음 첫 평일이 대체공휴일
  for (const [base, label, periodNames] of [
    [seollalBase, '설날', SEOLLAL_NAMES],
    [chuseokBase, '추석', CHUSEOK_NAMES],
  ] as [string | null, string, Set<string>][]) {
    if (!base) continue
    const period = [-1, 0, 1].map(n => offsetDate(base, n))
    const hasConflict = period.some(ds => {
      if (new Date(ds + 'T00:00:00').getDay() === 0) return true
      const name = map.get(ds)
      return name != null && !periodNames.has(name)
    })
    if (!hasConflict) continue
    const sub = new Date(period[period.length - 1] + 'T00:00:00')
    sub.setDate(sub.getDate() + 1)
    while (map.has(toStr(sub)) || sub.getDay() === 0) sub.setDate(sub.getDate() + 1)
    map.set(toStr(sub), `${label} 대체공휴일`)
  }

  // 단일 공휴일이 일요일이면 다음 첫 비공휴일이 대체공휴일
  for (const [dateStr, name] of Array.from(map.entries())) {
    if (PERIOD_NAMES.has(name) || name.includes('대체공휴일')) continue
    if (new Date(dateStr + 'T00:00:00').getDay() !== 0) continue
    const sub = new Date(dateStr + 'T00:00:00')
    sub.setDate(sub.getDate() + 1)
    while (map.has(toStr(sub))) sub.setDate(sub.getDate() + 1)
    map.set(toStr(sub), `${name} 대체공휴일`)
  }
}

function buildHolidayMap(year: number): Map<string, string> {
  if (holidayCache.has(year)) return holidayCache.get(year)!
  const map = new Map<string, string>()

  for (const [mmdd, name] of Object.entries(SOLAR_HOLIDAYS)) {
    map.set(`${year}-${mmdd}`, name)
  }

  for (const [dateStr, name] of Object.entries(ELECTION_DAYS)) {
    if (dateStr.startsWith(`${year}-`)) map.set(dateStr, name)
  }

  let seollalBase: string | null = null
  let chuseokBase: string | null = null

  for (const { key, month, day, offsets, names } of LUNAR_HOLIDAY_DEFS) {
    try {
      const c = new KoreanLunarCalendar()
      c.setLunarDate(year, month, day, false)
      const solar = c.getSolarCalendar()
      if (!solar) continue
      const base = `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`
      if (key === 'seollal') seollalBase = base
      if (key === 'chuseok') chuseokBase = base
      for (let i = 0; i < offsets.length; i++) {
        const ds = offsetDate(base, offsets[i])
        if (!map.has(ds)) map.set(ds, names[i])
      }
    } catch { /* skip */ }
  }

  addSubstituteHolidays(map, seollalBase, chuseokBase)

  holidayCache.set(year, map)
  return map
}

export function getLunarDateStr(year: number, month: number, day: number): string {
  try {
    const c = new KoreanLunarCalendar()
    c.setSolarDate(year, month, day)
    const lunar = c.getLunarCalendar()
    if (!lunar) return ''
    const prefix = lunar.intercalation ? '윤' : ''
    return `${prefix}${lunar.month}/${lunar.day}`
  } catch {
    return ''
  }
}

export function getLunarDateFull(year: number, month: number, day: number): string {
  try {
    const c = new KoreanLunarCalendar()
    c.setSolarDate(year, month, day)
    const lunar = c.getLunarCalendar()
    if (!lunar) return ''
    const prefix = lunar.intercalation ? '윤' : ''
    return `음력 ${lunar.year}년 ${prefix}${lunar.month}월 ${lunar.day}일`
  } catch {
    return ''
  }
}

export function getKoreanHoliday(dateStr: string): string | null {
  const year = parseInt(dateStr.slice(0, 4))
  return buildHolidayMap(year).get(dateStr) ?? null
}
