import type { DaySeatSummary } from './types'

/** 캘린더 날짜(YYYY-MM-DD) 기준 요일 — 타임존 영향 없음 (0=일, 6=토) */
export function getCalendarDayOfWeek(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isWeekend(dateIso: string): boolean {
  const dow = getCalendarDayOfWeek(dateIso)
  return dow === 0 || dow === 6
}

/** 주말·공휴일 (모니터링 미운영일과 구분) */
export function isClosedDay(dateIso: string, summary?: DaySeatSummary): boolean {
  if (summary?.unscheduled) return false
  if (summary?.closed === true) return true
  return isWeekend(dateIso)
}

export function isUnscheduledMonitoringDay(summary?: DaySeatSummary): boolean {
  return summary?.unscheduled === true
}

export function closedDayLabel(dateIso: string, summary?: DaySeatSummary): string {
  if (summary?.closedLabel) return summary.closedLabel
  if (isWeekend(dateIso)) return '주말'
  return '휴무'
}
