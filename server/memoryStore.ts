import { parseISO } from 'date-fns'
import type { Booking, CreateBookingInput } from './types.js'

const bookings = new Map<string, Booking>()

export function isMemoryStoreEnabled() {
  return !process.env.NOTION_API_TOKEN
}

export function memoryQueryBookings(from: string, to: string): Booking[] {
  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  return [...bookings.values()].filter((b) => {
    const start = parseISO(b.startAt)
    return start >= fromDate && start <= toDate
  })
}

export function memoryCreateBooking(booking: Booking) {
  bookings.set(booking.id, booking)
  return booking.notionPageId
}

export function memoryFindByBookingId(bookingId: string): Booking | null {
  return bookings.get(bookingId.toUpperCase()) ?? null
}

export function memoryFindByEmail(email: string): Booking[] {
  const normalized = email.trim().toLowerCase()
  return [...bookings.values()].filter(
    (b) => b.visitorEmail.toLowerCase() === normalized,
  )
}

export function memoryCancelBooking(pageId: string) {
  for (const [id, booking] of bookings) {
    if (booking.notionPageId === pageId) {
      bookings.set(id, { ...booking, status: 'cancelled' })
      return
    }
  }
}

export function memoryRestoreBooking(pageId: string) {
  for (const [id, booking] of bookings) {
    if (booking.notionPageId === pageId) {
      bookings.set(id, { ...booking, status: 'confirmed' })
      return
    }
  }
}

export function memoryUpdateBooking(
  pageId: string,
  updates: Partial<Pick<Booking, 'startAt' | 'endAt' | 'roomId' | 'roomName'>>,
) {
  for (const [id, booking] of bookings) {
    if (booking.notionPageId === pageId) {
      bookings.set(id, { ...booking, ...updates })
      return
    }
  }
}

export function memoryCreateBookingFromInput(
  bookingId: string,
  cancelToken: string,
  input: CreateBookingInput,
  roomName: string,
  googleEventId?: string,
): Booking {
  const booking: Booking = {
    id: bookingId,
    notionPageId: `mem-${bookingId}`,
    roomId: input.roomId,
    roomName,
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
  memoryCreateBooking(booking)
  return booking
}
