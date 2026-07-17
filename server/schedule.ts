import { ROOMS } from './rooms.js'
import { getSettings } from './settingsStore.js'
import { findBlockForStart, normalizeTimeBlocks, unionRoomIds } from './timeBlocks.js'
import { getWeekdayKey } from './weekday.js'
import type { DaySchedule, RoomId, WeekdayKey } from './types.js'
import { WEEKDAY_KEYS } from './weekday.js'

function filterValidRoomIds(ids: RoomId[]): RoomId[] {
  const validRoomIds = new Set(ROOMS.map((r) => r.id))
  return ids.filter((id): id is RoomId => validRoomIds.has(id))
}

export function normalizeDaySchedule(raw: Partial<DaySchedule>, fallbackRooms: RoomId[]): DaySchedule {
  const dayFallback = filterValidRoomIds(
    raw.enabledRoomIds !== undefined ? raw.enabledRoomIds : fallbackRooms,
  )
  const timeBlocks = normalizeTimeBlocks(raw.timeBlocks !== undefined ? raw.timeBlocks : []).map(
    (block) => ({
      ...block,
      enabledRoomIds:
        block.enabledRoomIds.length > 0 || raw.enabledRoomIds === undefined
          ? filterValidRoomIds(block.enabledRoomIds)
          : dayFallback,
    }),
  )

  return { timeBlocks }
}

export function normalizeWeekdaySchedules(
  raw: Partial<Record<WeekdayKey, Partial<DaySchedule>>>,
  base: DaySchedule,
): Record<WeekdayKey, DaySchedule> {
  const result = {} as Record<WeekdayKey, DaySchedule>
  const fallbackRooms = unionRoomIds(base.timeBlocks)
  for (const key of WEEKDAY_KEYS) {
    result[key] = normalizeDaySchedule(raw[key] ?? base, fallbackRooms)
  }
  return result
}

export function getScheduleForDate(dateIso: string): DaySchedule {
  const settings = getSettings()
  return settings.weekdaySchedules[getWeekdayKey(dateIso)]
}

export function getDayRoomIds(dateIso: string): RoomId[] {
  return unionRoomIds(getScheduleForDate(dateIso).timeBlocks)
}

export function isRoomEnabledForSlot(roomId: RoomId, dateIso: string, startTime: string): boolean {
  const block = findBlockForStart(getScheduleForDate(dateIso).timeBlocks, startTime)
  return block?.enabledRoomIds.includes(roomId) ?? false
}

/** @deprecated use isRoomEnabledForSlot */
export function isRoomEnabledForDate(roomId: RoomId, dateIso: string): boolean {
  return getDayRoomIds(dateIso).includes(roomId)
}

export function cloneSchedule(schedule: DaySchedule): DaySchedule {
  return {
    timeBlocks: schedule.timeBlocks.map((b) => ({
      ...b,
      enabledRoomIds: [...b.enabledRoomIds],
    })),
  }
}
