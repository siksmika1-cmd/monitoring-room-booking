import { parseISO } from 'date-fns'
import { getScheduleForDate } from './schedule.js'
import { blockToIsoRange } from './timeBlocks.js'
import type { Booking, RoomId, TimeSlot } from './types.js'

export function generateDaySlots(dateIso: string): { startAt: string; endAt: string }[] {
  const { timeBlocks } = getScheduleForDate(dateIso)
  return timeBlocks.map((block) => blockToIsoRange(dateIso, block))
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export function buildAvailability(
  dateIso: string,
  roomId: RoomId,
  bookings: Booking[],
): TimeSlot[] {
  const daySlots = generateDaySlots(dateIso)
  const roomBookings = bookings.filter(
    (b) => b.roomId === roomId && b.status === 'confirmed',
  )

  return daySlots.map((slot) => {
    const slotStart = parseISO(slot.startAt)
    const slotEnd = parseISO(slot.endAt)
    const conflict = roomBookings.find((b) => {
      const bStart = parseISO(b.startAt)
      const bEnd = parseISO(b.endAt)
      return overlaps(slotStart, slotEnd, bStart, bEnd)
    })

    return {
      ...slot,
      available: !conflict,
      bookingId: conflict?.id,
    }
  })
}

export function isTimeRangeAvailable(
  startAt: string,
  endAt: string,
  bookings: Booking[],
  roomId: RoomId,
): boolean {
  const start = parseISO(startAt)
  const end = parseISO(endAt)
  const roomBookings = bookings.filter(
    (b) => b.roomId === roomId && b.status === 'confirmed',
  )

  return !roomBookings.some((b) =>
    overlaps(start, end, parseISO(b.startAt), parseISO(b.endAt)),
  )
}
