import type { DaySchedule } from './types'

export function cloneSchedule(schedule: DaySchedule): DaySchedule {
  return {
    timeBlocks: schedule.timeBlocks.map((b) => ({ ...b })),
    enabledRoomIds: [...schedule.enabledRoomIds],
  }
}
