import type { AppSettings, DaySchedule, Room, RoomId } from './types'
import { getWeekdayKey } from './weekday'
import { blockKey, findBlockForStart, unionRoomIds } from './timeBlocks'

export function getDaySchedule(settings: AppSettings, dateIso: string): DaySchedule {
  return settings.weekdaySchedules[getWeekdayKey(dateIso)]
}

export function roomsForDate(
  settings: AppSettings,
  rooms: Room[],
  dateIso: string,
): (Room & { enabled: boolean })[] {
  const enabled = new Set(unionRoomIds(getDaySchedule(settings, dateIso).timeBlocks))
  return rooms.map((room) => ({ ...room, enabled: enabled.has(room.id) }))
}

export function roomsForSlot(
  settings: AppSettings,
  rooms: Room[],
  dateIso: string,
  startTime: string,
): (Room & { enabled: boolean })[] {
  const block = findBlockForStart(getDaySchedule(settings, dateIso).timeBlocks, startTime)
  const enabled = new Set(block?.enabledRoomIds ?? [])
  return rooms.map((room) => ({ ...room, enabled: enabled.has(room.id) }))
}

export function isRoomEnabledForSlot(
  settings: AppSettings,
  roomId: RoomId,
  dateIso: string,
  startTime: string,
): boolean {
  const block = findBlockForStart(getDaySchedule(settings, dateIso).timeBlocks, startTime)
  return block?.enabledRoomIds.includes(roomId) ?? false
}

/** @deprecated use isRoomEnabledForSlot */
export function isRoomEnabledForDate(settings: AppSettings, roomId: RoomId, dateIso: string): boolean {
  return unionRoomIds(getDaySchedule(settings, dateIso).timeBlocks).includes(roomId)
}

export function isDayScheduled(settings: AppSettings, dateIso: string): boolean {
  const { timeBlocks } = getDaySchedule(settings, dateIso)
  return timeBlocks.some((block) => block.enabledRoomIds.length > 0)
}

export function scheduleBlockKey(dateIso: string, startTime: string, endTime: string): string {
  return `${dateIso}:${blockKey({ start: startTime, end: endTime, enabledRoomIds: [] })}`
}
