import type { DaySchedule, WeekdayKey } from './types.js'

export const WEEKDAY_KEYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
}

/** 0=일 … 6=토 */
const DOW_TO_KEY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function getCalendarDayOfWeek(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function getWeekdayKey(dateIso: string): WeekdayKey {
  return DOW_TO_KEY[getCalendarDayOfWeek(dateIso)]
}

export function isWeekendKey(key: WeekdayKey): boolean {
  return key === 'sat' || key === 'sun'
}

export function formatWeekdayLabel(dateIso: string): string {
  return WEEKDAY_LABELS[getWeekdayKey(dateIso)]
}

export function emptySchedule(): DaySchedule {
  return { timeBlocks: [] }
}
