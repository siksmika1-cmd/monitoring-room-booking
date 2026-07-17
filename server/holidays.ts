import Holidays from 'date-holidays'
import { parseISO } from 'date-fns'
import { isBlockedDate } from './blockedDates.js'
import { getSettings } from './settingsStore.js'

const krHolidays = new Holidays('KR')

/** 캘린더 날짜(YYYY-MM-DD) 기준 요일 — 타임존 영향 없음 */
function getCalendarDayOfWeek(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function getClosedDayReason(dateIso: string): 'weekend' | 'holiday' | 'blocked' | null {
  if (isBlockedDate(dateIso, getSettings().blockedDates)) return 'blocked'

  const dow = getCalendarDayOfWeek(dateIso)
  if (dow === 0 || dow === 6) return 'weekend'
  if (krHolidays.isHoliday(parseISO(`${dateIso}T12:00:00+09:00`))) return 'holiday'
  return null
}

export function isClosedDay(dateIso: string): boolean {
  return getClosedDayReason(dateIso) !== null
}

export function closedDayLabel(dateIso: string): string {
  const reason = getClosedDayReason(dateIso)
  if (reason === 'blocked') return '예약 불가'
  if (reason === 'weekend') return '주말'
  if (reason === 'holiday') {
    const info = krHolidays.isHoliday(parseISO(`${dateIso}T12:00:00+09:00`))
    const entry = Array.isArray(info) ? info[0] : info
    if (entry && typeof entry === 'object' && 'name' in entry && entry.name) {
      return String(entry.name)
    }
    return '공휴일'
  }
  return ''
}
