import type { AppSettings, Booking, CreateBookingInput, Room, RoomId, TimeSlot } from './types'

const BOOKINGS_BASE = '/api/bookings'
const SETTINGS_BASE = '/api/settings'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`)
  return data
}

export async function fetchSettings() {
  return request<{ settings: AppSettings; rooms: Room[] }>(SETTINGS_BASE)
}

export async function loginAdmin(password: string) {
  await request<{ ok: boolean }>(SETTINGS_BASE, {
    method: 'POST',
    body: JSON.stringify({ action: 'login', password }),
  })
}

export async function updateSettings(password: string, settings: Partial<AppSettings>) {
  return request<{ settings: AppSettings; rooms: Room[] }>(SETTINGS_BASE, {
      method: 'PUT',
      body: JSON.stringify({ password, settings }),
    },
  )
}

export async function fetchMonthSummary(year: number, month: number) {
  const { days } = await request<{ days: Record<string, import('./types').DaySeatSummary> }>(
    `${BOOKINGS_BASE}?action=month&year=${year}&month=${month}`,
  )
  return days
}

export async function fetchDayBookings(date: string) {
  const { bookings } = await request<{ bookings: Booking[] }>(
    `${BOOKINGS_BASE}?action=day&date=${encodeURIComponent(date)}`,
  )
  return bookings
}

export async function fetchAvailability(date: string, roomId: RoomId) {
  const { slots } = await request<{ slots: TimeSlot[] }>(
    `${BOOKINGS_BASE}?action=availability&date=${encodeURIComponent(date)}&roomId=${roomId}`,
  )
  return slots
}

export async function createBooking(input: CreateBookingInput) {
  const { booking } = await request<{ booking: Booking }>(BOOKINGS_BASE, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return booking
}

export async function lookupBooking(criteria: {
  bookingId?: string
  visitorName?: string
  email?: string
}) {
  const params = new URLSearchParams({ action: 'lookup' })
  if (criteria.bookingId?.trim()) params.set('bookingId', criteria.bookingId.trim().toUpperCase())
  if (criteria.visitorName?.trim()) params.set('visitorName', criteria.visitorName.trim())
  if (criteria.email?.trim()) params.set('email', criteria.email.trim())

  const { bookings } = await request<{ bookings: Booking[] }>(
    `${BOOKINGS_BASE}?${params.toString()}`,
  )
  return bookings
}

export async function cancelBooking(bookingId: string, cancelToken: string) {
  const { booking } = await request<{ booking: Booking }>(BOOKINGS_BASE, {
    method: 'POST',
    body: JSON.stringify({ action: 'cancel', bookingId, cancelToken }),
  })
  return booking
}

export async function restoreBooking(bookingId: string, cancelToken: string) {
  const { booking } = await request<{ booking: Booking }>(BOOKINGS_BASE, {
    method: 'POST',
    body: JSON.stringify({ action: 'restore', bookingId, cancelToken }),
  })
  return booking
}

export async function updateBookingSchedule(
  bookingId: string,
  cancelToken: string,
  input: { startAt: string; endAt: string; roomId?: RoomId },
) {
  const { booking } = await request<{ booking: Booking }>(BOOKINGS_BASE, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', bookingId, cancelToken, ...input }),
  })
  return booking
}
