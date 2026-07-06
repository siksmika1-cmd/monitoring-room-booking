import { google } from 'googleapis'
import type { CreateBookingInput } from './types.js'

function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  if (!clientEmail || !privateKey || !calendarId) {
    return null
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  return { calendar: google.calendar({ version: 'v3', auth }), calendarId }
}

function bookingSlotKey(input: CreateBookingInput): string {
  return `${input.roomId}|${input.startAt}|${input.endAt}|${input.visitorEmail.trim().toLowerCase()}`
}

function buildEventBody(input: CreateBookingInput, bookingId: string) {
  const slotKey = bookingSlotKey(input)
  return {
    summary: `${input.protocolNo} · ${input.irbNo} · ${input.visitorName}`,
    description: [
      `Protocol No.: ${input.protocolNo}`,
      `IRB No.: ${input.irbNo}`,
      `방문자: ${input.visitorName}`,
      `이메일: ${input.visitorEmail}`,
      `연락처: ${input.visitorPhone}`,
      input.company ? `소속: ${input.company}` : '',
      input.purpose ? `목적: ${input.purpose}` : '',
      `예약 ID: ${bookingId}`,
    ]
      .filter(Boolean)
      .join('\n'),
    extendedProperties: {
      private: {
        bookingId,
        slotKey,
      },
    },
    start: { dateTime: input.startAt, timeZone: 'Asia/Seoul' },
    end: { dateTime: input.endAt, timeZone: 'Asia/Seoul' },
  }
}

async function googleFindEventByPrivateProp(
  key: string,
  value: string,
): Promise<string | undefined> {
  const client = getCalendarClient()
  if (!client) return undefined

  const res = await client.calendar.events.list({
    calendarId: client.calendarId,
    privateExtendedProperty: [`${key}=${value}`],
    maxResults: 1,
    singleEvents: true,
  })

  return res.data.items?.[0]?.id ?? undefined
}

export async function googleCreateEvent(
  input: CreateBookingInput,
  bookingId: string,
): Promise<string | undefined> {
  const client = getCalendarClient()
  if (!client) return undefined

  const body = buildEventBody(input, bookingId)
  const slotKey = bookingSlotKey(input)

  const existingByBooking = await googleFindEventByPrivateProp('bookingId', bookingId)
  if (existingByBooking) {
    await client.calendar.events.patch({
      calendarId: client.calendarId,
      eventId: existingByBooking,
      requestBody: body,
    })
    return existingByBooking
  }

  const existingBySlot = await googleFindEventByPrivateProp('slotKey', slotKey)
  if (existingBySlot) {
    await client.calendar.events.patch({
      calendarId: client.calendarId,
      eventId: existingBySlot,
      requestBody: body,
    })
    return existingBySlot
  }

  const event = await client.calendar.events.insert({
    calendarId: client.calendarId,
    requestBody: body,
  })

  return event.data.id ?? undefined
}

export async function googleDeleteEvent(eventId: string) {
  const client = getCalendarClient()
  if (!client) return

  await client.calendar.events.delete({
    calendarId: client.calendarId,
    eventId,
  })
}

export function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_CALENDAR_ID,
  )
}
