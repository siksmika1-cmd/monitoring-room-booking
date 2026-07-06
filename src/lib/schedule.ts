import type { AppSettings, DaySchedule, Room, RoomId } from './types'
import { getWeekdayKey } from './weekday'

export function getDaySchedule(settings: AppSettings, dateIso: string): DaySchedule {
  return settings.weekdaySchedules[getWeekdayKey(dateIso)]
}

export function roomsForDate(
  settings: AppSettings,
  rooms: Room[],
  dateIso: string,
): (Room & { enabled: boolean })[] {
  const enabled = new Set(getDaySchedule(settings, dateIso).enabledRoomIds)
  return rooms.map((room) => ({ ...room, enabled: enabled.has(room.id) }))
}

export function isRoomEnabledForDate(settings: AppSettings, roomId: RoomId, dateIso: string): boolean {
  return getDaySchedule(settings, dateIso).enabledRoomIds.includes(roomId)
}
