export type RoomId = 'room-2p-a' | 'room-2p-b' | 'room-1p'

export type BookingStatus = 'confirmed' | 'cancelled'

export interface Room {
  id: RoomId
  name: string
  capacity: number
  description: string
}

export interface Booking {
  id: string
  roomId: RoomId
  roomName: string
  startAt: string
  endAt: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  protocolNo: string
  irbNo: string
  company?: string
  purpose?: string
  status: BookingStatus
  cancelToken: string
  googleEventId?: string
  notionPageId: string
  createdAt: string
}

export interface CreateBookingInput {
  roomId: RoomId
  startAt: string
  endAt: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  protocolNo: string
  irbNo: string
  company?: string
  purpose?: string
}

export interface TimeSlot {
  startAt: string
  endAt: string
  available: boolean
  bookingId?: string
}

export interface TimeBlock {
  start: string
  end: string
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface DaySchedule {
  timeBlocks: TimeBlock[]
  enabledRoomIds: RoomId[]
}

export interface AppSettings {
  slotMinutes: number
  weekdaySchedules: Record<WeekdayKey, DaySchedule>
  /** 설정 저장 시각 (달력·예약 캐시 갱신용) */
  updatedAt?: string
  /** @deprecated 마이그레이션용 */
  timeBlocks?: TimeBlock[]
  /** @deprecated 마이그레이션용 */
  enabledRoomIds?: RoomId[]
  /** @deprecated 마이그레이션용 */
  openHour?: number
  /** @deprecated 마이그레이션용 */
  closeHour?: number
}

export interface DaySeatSummary {
  total: number
  occupied: number
  available: number
  closed?: boolean
  closedLabel?: string
  /** 모니터링 좌석·시간 미설정 (약국은 운영, 모니터링 예약만 없음) */
  unscheduled?: boolean
}
