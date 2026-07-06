import { addMinutes, parseISO } from 'date-fns'

const KST_OFFSET = '+09:00'

/** KST 기준 ISO datetime 문자열 생성 */
export function kstDateTime(
  dateIso: string,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0,
): string {
  const h = String(hour).padStart(2, '0')
  const m = String(minute).padStart(2, '0')
  const s = String(second).padStart(2, '0')
  const msStr = String(ms).padStart(3, '0')
  return `${dateIso}T${h}:${m}:${s}.${msStr}${KST_OFFSET}`
}

export function kstDayStart(dateIso: string): string {
  return kstDateTime(dateIso, 0, 0, 0, 0)
}

export function kstDayEnd(dateIso: string): string {
  return kstDateTime(dateIso, 23, 59, 59, 999)
}

export function parseKst(iso: string): Date {
  return parseISO(iso)
}

export function addKstMinutes(iso: string, minutes: number): string {
  return addMinutes(parseISO(iso), minutes).toISOString()
}

/** ISO 문자열에서 KST 시각(HH:mm) — 서버 타임존(UTC)과 무관 */
export function kstTimeLabel(iso: string): string {
  const offsetMatch = iso.match(/([+-]\d{2}:\d{2}|Z)$/)
  if (offsetMatch?.[1] === '+09:00') {
    const timeMatch = iso.match(/T(\d{2}):(\d{2})/)
    if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`
  }

  const date = parseISO(iso)
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** ISO 문자열에서 KST 날짜(YYYY-MM-DD) */
export function kstDateIso(iso: string): string {
  const offsetMatch = iso.match(/([+-]\d{2}:\d{2}|Z)$/)
  if (offsetMatch?.[1] === '+09:00') {
    const dateMatch = iso.match(/^(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) return dateMatch[1]
  }

  const date = parseISO(iso)
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}
