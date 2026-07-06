import { randomBytes, randomUUID } from 'node:crypto'
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { buildAvailability, isTimeRangeAvailable } from './slots.js'
import {
  notionCancelBooking,
  notionCreateBooking,
  notionFindByBookingId,
  notionFindByEmail,
  notionQueryBookings,
  notionUpdateGoogleEventId,
} from './notion.js'
import { googleCreateEvent, googleDeleteEvent } from './googleCalendar.js'
import { closedDayLabel, isClosedDay } from './holidays.js'
import {
  isMemoryStoreEnabled,
  memoryCancelBooking,
  memoryCreateBookingFromInput,
  memoryFindByBookingId,
  memoryFindByEmail,
  memoryQueryBookings,
} from './memoryStore.js'
import { ROOM_MAP } from './rooms.js'
import { isRoomEnabledForDate, getScheduleForDate } from './schedule.js'
import { isRangeCoveredByBlocks } from './timeBlocks.js'
import { kstDayEnd, kstDayStart, kstDateIso, kstTimeLabel } from './timezone.js'
import type { Booking, CreateBookingInput, DaySeatSummary, RoomId } from './types.js'

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

function isUnscheduledDay(dateIso: string): boolean {
  const { timeBlocks, enabledRoomIds } = getScheduleForDate(dateIso)
  return timeBlocks.length === 0 || enabledRoomIds.length === 0
}

function validateInput(input: CreateBookingInput) {
  if (!ROOM_MAP[input.roomId]) throw new Error('유효하지 않은 룸입니다')

  const dateIso = kstDateIso(input.startAt)
  if (isClosedDay(dateIso)) {
    throw new Error('주말 및 공휴일은 모니터링을 실시하지 않아 예약할 수 없습니다')
  }
  if (isUnscheduledDay(dateIso)) {
    throw new Error('해당 요일은 예약을 받지 않습니다')
  }
  if (!isRoomEnabledForDate(input.roomId, dateIso)) throw new Error('현재 예약할 수 없는 룸입니다')
  if (!input.visitorName.trim()) throw new Error('이름을 입력해 주세요')
  if (!input.visitorEmail.trim()) throw new Error('이메일을 입력해 주세요')
  if (!input.visitorPhone.trim()) throw new Error('연락처를 입력해 주세요')
  if (!input.protocolNo.trim()) throw new Error('Protocol No.를 입력해 주세요')
  if (!input.irbNo.trim()) throw new Error('IRB No.를 입력해 주세요')

  const start = parseISO(input.startAt)
  const end = parseISO(input.endAt)
  if (!(start < end)) throw new Error('예약 시간이 올바르지 않습니다')

  const { timeBlocks } = getScheduleForDate(dateIso)
  const startTime = kstTimeLabel(input.startAt)
  const endTime = kstTimeLabel(input.endAt)

  if (!isRangeCoveredByBlocks(startTime, endTime, timeBlocks)) {
    throw new Error('관리자가 설정한 예약 가능 시간이 아닙니다')
  }
}

export async function getBookingsForDate(dateIso: string) {
  return getBookingsForRange(dateIso, dateIso)
}

export async function getBookingsForRange(fromDateIso: string, toDateIso: string) {
  const dayStart = kstDayStart(fromDateIso)
  const dayEnd = kstDayEnd(toDateIso)

  if (isMemoryStoreEnabled()) {
    return memoryQueryBookings(dayStart, dayEnd)
  }

  return notionQueryBookings(dayStart, dayEnd)
}

export async function getMonthSeatSummary(
  year: number,
  month: number,
): Promise<Record<string, DaySeatSummary>> {
  const anchor = parseISO(`${year}-${String(month).padStart(2, '0')}-01`)
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) })
  const from = format(days[0], 'yyyy-MM-dd')
  const to = format(days[days.length - 1], 'yyyy-MM-dd')
  const bookings = await getBookingsForRange(from, to)

  const result: Record<string, DaySeatSummary> = {}
  for (const day of days) {
    const dateIso = format(day, 'yyyy-MM-dd')
    if (isClosedDay(dateIso)) {
      result[dateIso] = {
        total: 0,
        occupied: 0,
        available: 0,
        closed: true,
        closedLabel: closedDayLabel(dateIso),
      }
      continue
    }
    if (isUnscheduledDay(dateIso)) {
      result[dateIso] = {
        total: 0,
        occupied: 0,
        available: 0,
        unscheduled: true,
      }
      continue
    }
    let total = 0
    let occupied = 0
    const { enabledRoomIds } = getScheduleForDate(dateIso)
    for (const roomId of enabledRoomIds) {
      const slots = buildAvailability(dateIso, roomId, bookings)
      total += slots.length
      occupied += slots.filter((s) => !s.available).length
    }
    result[dateIso] = { total, occupied, available: total - occupied }
  }
  return result
}

export async function getAvailability(dateIso: string, roomId: RoomId) {
  if (isClosedDay(dateIso) || isUnscheduledDay(dateIso) || !isRoomEnabledForDate(roomId, dateIso)) return []
  const bookings = await getBookingsForDate(dateIso)
  return buildAvailability(dateIso, roomId, bookings)
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  validateInput(input)

  const dateIso = kstDateIso(input.startAt)
  const existing = await getBookingsForDate(dateIso)
  const slotStart = parseISO(input.startAt)
  const slotEnd = parseISO(input.endAt)

  if (!isTimeRangeAvailable(input.startAt, input.endAt, existing, input.roomId)) {
    throw new Error('이미 예약된 시간입니다. 다른 시간을 선택해 주세요.')
  }

  const conflict = existing.find(
    (b) =>
      b.roomId === input.roomId &&
      b.status === 'confirmed' &&
      overlaps(slotStart, slotEnd, parseISO(b.startAt), parseISO(b.endAt)),
  )
  if (conflict) throw new Error('이미 예약된 시간입니다. 다른 시간을 선택해 주세요.')

  const bookingId = randomUUID().slice(0, 8).toUpperCase()
  const cancelToken = randomBytes(16).toString('hex')
  const room = ROOM_MAP[input.roomId]

  if (isMemoryStoreEnabled()) {
    let googleEventId: string | undefined
    try {
      googleEventId = await googleCreateEvent(input, bookingId)
    } catch {
      /* Google 미설정 시 메모리만 사용 */
    }
    return memoryCreateBookingFromInput(
      bookingId,
      cancelToken,
      input,
      room.name,
      googleEventId,
    )
  }

  const notionPageId = await notionCreateBooking(bookingId, cancelToken, input)

  let googleEventId: string | undefined
  try {
    googleEventId = await googleCreateEvent(input, bookingId)
    if (googleEventId) {
      await notionUpdateGoogleEventId(notionPageId, googleEventId)
    }
  } catch {
    /* Notion 예약은 유지, 캘린더만 미등록 */
  }

  return {
    id: bookingId,
    notionPageId,
    roomId: input.roomId,
    roomName: room.name,
    startAt: input.startAt,
    endAt: input.endAt,
    visitorName: input.visitorName.trim(),
    visitorEmail: input.visitorEmail.trim(),
    visitorPhone: input.visitorPhone.trim(),
    protocolNo: input.protocolNo.trim(),
    irbNo: input.irbNo.trim(),
    company: input.company?.trim(),
    purpose: input.purpose?.trim(),
    status: 'confirmed',
    cancelToken,
    googleEventId,
    createdAt: new Date().toISOString(),
  }
}

export async function cancelBooking(bookingId: string, cancelToken: string) {
  const booking = isMemoryStoreEnabled()
    ? memoryFindByBookingId(bookingId)
    : await notionFindByBookingId(bookingId)

  if (!booking) throw new Error('예약을 찾을 수 없습니다')
  if (booking.cancelToken !== cancelToken) throw new Error('취소 권한이 없습니다')
  if (booking.status === 'cancelled') throw new Error('이미 취소된 예약입니다')

  if (isMemoryStoreEnabled()) {
    memoryCancelBooking(booking.notionPageId)
  } else {
    await notionCancelBooking(booking.notionPageId)
  }

  if (booking.googleEventId) {
    try {
      await googleDeleteEvent(booking.googleEventId)
    } catch {
      /* ignore */
    }
  }

  return { ...booking, status: 'cancelled' as const }
}

export interface LookupBookingInput {
  bookingId?: string
  visitorName?: string
  email?: string
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function countLookupFields(input: LookupBookingInput): number {
  let count = 0
  if (input.bookingId?.trim()) count++
  if (input.visitorName?.trim()) count++
  if (input.email?.trim()) count++
  return count
}

function bookingMatchesLookup(booking: Booking, input: LookupBookingInput): boolean {
  if (input.bookingId?.trim()) {
    if (booking.id.toUpperCase() !== input.bookingId.trim().toUpperCase()) return false
  }
  if (input.email?.trim()) {
    if (booking.visitorEmail.toLowerCase() !== input.email.trim().toLowerCase()) return false
  }
  if (input.visitorName?.trim()) {
    if (normalizeName(booking.visitorName) !== normalizeName(input.visitorName)) return false
  }
  return true
}

async function findLookupCandidates(input: LookupBookingInput): Promise<Booking[]> {
  if (input.bookingId?.trim()) {
    const booking = isMemoryStoreEnabled()
      ? memoryFindByBookingId(input.bookingId)
      : await notionFindByBookingId(input.bookingId.trim().toUpperCase())
    return booking ? [booking] : []
  }

  if (input.email?.trim()) {
    return isMemoryStoreEnabled()
      ? memoryFindByEmail(input.email)
      : await notionFindByEmail(input.email)
  }

  return []
}

export async function lookupBooking(input: LookupBookingInput) {
  if (countLookupFields(input) < 2) {
    throw new Error('예약 번호, 예약자 이름, 이메일 중 2가지 이상 입력해 주세요')
  }

  const candidates = await findLookupCandidates(input)
  const matched = candidates.filter((booking) => bookingMatchesLookup(booking, input))

  if (matched.length === 0) {
    throw new Error('예약을 찾을 수 없습니다. 입력 정보를 확인해 주세요')
  }
  if (matched.length > 1) {
    throw new Error('조건에 맞는 예약이 여러 건입니다. 예약 번호를 함께 입력해 주세요')
  }

  return matched[0]
}
