import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  cancelBooking,
  createBooking,
  getAvailability,
  getBookingsForDate,
  getMonthSeatSummary,
  lookupBooking,
} from '../server/bookingService.js'
import type { CreateBookingInput, RoomId } from '../server/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const action = req.query.action as string | undefined

      if (action === 'availability') {
        const date = req.query.date as string
        const roomId = req.query.roomId as RoomId
        if (!date || !roomId) return res.status(400).json({ error: 'date, roomId 필요' })
        const slots = await getAvailability(date, roomId)
        return res.status(200).json({ slots })
      }

      if (action === 'day') {
        const date = req.query.date as string
        if (!date) return res.status(400).json({ error: 'date 필요' })
        const bookings = await getBookingsForDate(date)
        return res.status(200).json({ bookings })
      }

      if (action === 'month') {
        const year = Number(req.query.year)
        const month = Number(req.query.month)
        if (!year || !month || month < 1 || month > 12) {
          return res.status(400).json({ error: 'year, month 필요' })
        }
        const days = await getMonthSeatSummary(year, month)
        return res.status(200).json({ days })
      }

      if (action === 'lookup') {
        const bookingId = (req.query.bookingId as string | undefined)?.trim()
        const visitorName = (req.query.visitorName as string | undefined)?.trim()
        const email = (req.query.email as string | undefined)?.trim()
        const booking = await lookupBooking({ bookingId, visitorName, email })
        return res.status(200).json({ booking })
      }

      return res.status(400).json({ error: '알 수 없는 action' })
    }

    if (req.method === 'POST') {
      const body = req.body as {
        action?: string
        bookingId?: string
        cancelToken?: string
      } & Partial<CreateBookingInput>

      if (body.action === 'cancel') {
        if (!body.bookingId || !body.cancelToken) {
          return res.status(400).json({ error: 'bookingId, cancelToken 필요' })
        }
        const booking = await cancelBooking(body.bookingId, body.cancelToken)
        return res.status(200).json({ booking })
      }

      const input = body as CreateBookingInput
      if (!input.roomId || !input.startAt || !input.endAt) {
        return res.status(400).json({ error: '필수 예약 정보가 없습니다' })
      }

      const booking = await createBooking(input)
      return res.status(201).json({ booking })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    const message = e instanceof Error ? e.message : '서버 오류'
    const status = /찾을 수 없|일치하지|권한|이미/.test(message) ? 400 : 500
    return res.status(status).json({ error: message })
  }
}
