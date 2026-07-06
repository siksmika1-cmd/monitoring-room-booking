import { ROOMS } from './rooms.js'
import { getSettings } from './settingsStore.js'
import { normalizeTimeBlocks } from './timeBlocks.js'
import { getWeekdayKey } from './weekday.js'
import type { DaySchedule, RoomId, WeekdayKey } from './types.js'
import { WEEKDAY_KEYS } from './weekday.js'

export function normalizeDaySchedule(raw: Partial<DaySchedule>, fallbackRooms: RoomId[]): DaySchedule {
  const validRoomIds = new Set(ROOMS.map((r) => r.id))
  const enabledRoomIds = (raw.enabledRoomIds !== undefined ? raw.enabledRoomIds : fallbackRooms).filter(
    (id): id is RoomId => validRoomIds.has(id as RoomId),
  )
  const timeBlocks = normalizeTimeBlocks(raw.timeBlocks !== undefined ? raw.timeBlocks : [])
  return { timeBlocks, enabledRoomIds }
}

export function normalizeWeekdaySchedules(
  raw: Partial<Record<WeekdayKey, Partial<DaySchedule>>>,
  base: DaySchedule,
): Record<WeekdayKey, DaySchedule> {
  const result = {} as Record<WeekdayKey, DaySchedule>
  for (const key of WEEKDAY_KEYS) {
    result[key] = normalizeDaySchedule(raw[key] ?? base, base.enabledRoomIds)
  }
  return result
}

export function getScheduleForDate(dateIso: string): DaySchedule {
  const settings = getSettings()
  return settings.weekdaySchedules[getWeekdayKey(dateIso)]
}

export function isRoomEnabledForDate(roomId: RoomId, dateIso: string): boolean {
  return getScheduleForDate(dateIso).enabledRoomIds.includes(roomId)
}

export function cloneSchedule(schedule: DaySchedule): DaySchedule {
  return {
    timeBlocks: schedule.timeBlocks.map((b) => ({ ...b })),
    enabledRoomIds: [...schedule.enabledRoomIds],
  }
}
