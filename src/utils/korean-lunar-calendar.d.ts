declare module 'korean-lunar-calendar' {
  export default class KoreanLunarCalendar {
    setSolarDate(year: number, month: number, day: number): void
    setLunarDate(year: number, month: number, day: number, intercalation: boolean): void
    getLunarCalendar(): { year: number; month: number; day: number; intercalation: boolean } | null
    getSolarCalendar(): { year: number; month: number; day: number } | null
  }
}
