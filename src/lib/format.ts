import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getDaySchedule } from './schedule'
import type { AppSettings, TimeSlot } from './types'
import {
  buildEndOptionsForStart,
  formatTimeBlocksSummary,
  isRangeCoveredByBlocks,
  normalizeTimeBlocks,
} from './timeBlocks'

export function formatKoreanDate(dateIso: string) {
  return format(parseISO(dateIso), 'M월 d일 (EEE)', { locale: ko })
}

export function formatTimeRange(startAt: string, endAt: string) {
  return `${format(parseISO(startAt), 'HH:mm')} – ${format(parseISO(endAt), 'HH:mm')}`
}

export function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isEmbedMode() {
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === 'true' || window.self !== window.top
}

/** KST 기준 ISO datetime */
export function kstDateTimeFromParts(dateIso: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour = String(h).padStart(2, '0')
  const minute = String(m).padStart(2, '0')
  return `${dateIso}T${hour}:${minute}:00.000+09:00`
}

export function formatHourLabel(hour: number, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 선택 날짜의 시간 블록 시작 옵션 */
export function buildTimeOptions(settings: AppSettings, dateIso: string) {
  const { timeBlocks } = getDaySchedule(settings, dateIso)
  return normalizeTimeBlocks(timeBlocks).map((b) => b.start)
}

export function buildEndTimeOptions(startTime: string, settings: AppSettings, dateIso: string): string[] {
  const { timeBlocks } = getDaySchedule(settings, dateIso)
  return buildEndOptionsForStart(startTime, timeBlocks)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export function isRangeAvailable(
  dateIso: string,
  startTime: string,
  endTime: string,
  slots: TimeSlot[],
  settings: AppSettings,
): boolean {
  const { timeBlocks } = getDaySchedule(settings, dateIso)
  if (!isRangeCoveredByBlocks(startTime, endTime, timeBlocks)) return false

  const startAt = kstDateTimeFromParts(dateIso, startTime)
  const endAt = kstDateTimeFromParts(dateIso, endTime)
  const start = parseISO(startAt)
  const end = parseISO(endAt)

  const blocked = slots.filter((s) => !s.available)
  return !blocked.some((s) =>
    overlaps(start, end, parseISO(s.startAt), parseISO(s.endAt)),
  )
}

export function formatHoursRange(settings: AppSettings, dateIso: string) {
  const { timeBlocks } = getDaySchedule(settings, dateIso)
  return formatTimeBlocksSummary(timeBlocks)
}
