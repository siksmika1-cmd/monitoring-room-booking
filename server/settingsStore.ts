import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOMS } from './rooms.js'
import { cloneSchedule, normalizeDaySchedule, normalizeWeekdaySchedules } from './schedule.js'
import {
  generateCandidateBlocks,
  migrateLegacySettings,
  normalizeTimeBlocks,
} from './timeBlocks.js'
import { WEEKDAY_KEYS } from './weekday.js'
import type { AppSettings, DaySchedule, RoomId, WeekdayKey } from './types.js'

/** import.meta.url 기준 — process.cwd()와 무관하게 항상 프로젝트 data/ 를 가리킴 */
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SETTINGS_PATH = path.resolve(PROJECT_ROOT, 'data/settings.json')

const CACHE_KEY = '__monitoring_room_booking_settings__'

interface SettingsCache {
  settings: AppSettings
  fileMtime: number
}

const DEFAULT_DAY_BLOCKS = generateCandidateBlocks(60).filter((b) => {
  const start = Number(b.start.slice(0, 2))
  return start >= 9 && start < 16
})

const DEFAULT_BASE_SCHEDULE: DaySchedule = {
  timeBlocks: DEFAULT_DAY_BLOCKS,
  enabledRoomIds: ROOMS.map((r) => r.id),
}

function buildDefaultWeekdaySchedules(): Record<WeekdayKey, DaySchedule> {
  const weekday = cloneSchedule(DEFAULT_BASE_SCHEDULE)
  const weekend = { timeBlocks: [], enabledRoomIds: [] as RoomId[] }
  return {
    mon: cloneSchedule(weekday),
    tue: cloneSchedule(weekday),
    wed: cloneSchedule(weekday),
    thu: cloneSchedule(weekday),
    fri: cloneSchedule(weekday),
    sat: cloneSchedule(weekend),
    sun: cloneSchedule(weekend),
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  slotMinutes: 60,
  weekdaySchedules: buildDefaultWeekdaySchedules(),
}

function getFileMtime(): number {
  try {
    return existsSync(SETTINGS_PATH) ? statSync(SETTINGS_PATH).mtimeMs : 0
  } catch {
    return 0
  }
}

function getGlobalCache(): SettingsCache | null {
  return (globalThis as Record<string, unknown>)[CACHE_KEY] as SettingsCache | null ?? null
}

function setGlobalCache(cache: SettingsCache) {
  ;(globalThis as Record<string, unknown>)[CACHE_KEY] = cache
}

function migrateWeekdaySchedules(raw: Partial<AppSettings>, slotMinutes: number): Record<WeekdayKey, DaySchedule> {
  if (raw.weekdaySchedules) {
    return normalizeWeekdaySchedules(raw.weekdaySchedules, DEFAULT_BASE_SCHEDULE)
  }

  const timeBlocks = normalizeTimeBlocks(migrateLegacySettings({ ...raw, slotMinutes }))
  const validRoomIds = new Set(ROOMS.map((r) => r.id))
  const enabledRoomIds = (raw.enabledRoomIds ?? DEFAULT_BASE_SCHEDULE.enabledRoomIds).filter(
    (id): id is RoomId => validRoomIds.has(id as RoomId),
  )
  const base = normalizeDaySchedule({ timeBlocks, enabledRoomIds }, DEFAULT_BASE_SCHEDULE.enabledRoomIds)
  const schedules = buildDefaultWeekdaySchedules()

  for (const key of WEEKDAY_KEYS) {
    if (key === 'sat' || key === 'sun') {
      schedules[key] = { timeBlocks: [], enabledRoomIds: [] }
    } else {
      schedules[key] = cloneSchedule(base)
    }
  }
  return schedules
}

function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const slotMinutes = [30, 60].includes(raw.slotMinutes ?? 0)
    ? raw.slotMinutes!
    : DEFAULT_SETTINGS.slotMinutes

  const weekdaySchedules = migrateWeekdaySchedules(raw, slotMinutes)

  return {
    slotMinutes,
    weekdaySchedules,
    updatedAt: raw.updatedAt,
  }
}

function toPersistedSettings(settings: AppSettings): AppSettings {
  return {
    slotMinutes: settings.slotMinutes,
    weekdaySchedules: settings.weekdaySchedules,
    updatedAt: settings.updatedAt,
  }
}

function readFromFile(): AppSettings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<AppSettings>
      const settings = normalizeSettings(raw)
      if (!raw.weekdaySchedules) {
        try {
          writeToFile({ ...settings, updatedAt: settings.updatedAt ?? new Date().toISOString() })
        } catch {
          /* ignore */
        }
      }
      return settings
    }
  } catch {
    /* fall through */
  }
  return {
    slotMinutes: DEFAULT_SETTINGS.slotMinutes,
    weekdaySchedules: buildDefaultWeekdaySchedules(),
  }
}

function writeToFile(settings: AppSettings) {
  const dir = path.dirname(SETTINGS_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(toPersistedSettings(settings), null, 2)}\n`, 'utf8')
}

function persistSettings(settings: AppSettings): AppSettings {
  writeToFile(settings)
  setGlobalCache({ settings, fileMtime: getFileMtime() })
  return settings
}

export function getSettings(): AppSettings {
  const fileMtime = getFileMtime()
  const cached = getGlobalCache()
  if (cached && cached.fileMtime === fileMtime) {
    return cached.settings
  }

  const settings = readFromFile()
  setGlobalCache({ settings, fileMtime: getFileMtime() })
  return settings
}

export function updateSettings(next: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const settings = normalizeSettings({
    slotMinutes: next.slotMinutes ?? current.slotMinutes,
    weekdaySchedules: next.weekdaySchedules ?? current.weekdaySchedules,
    updatedAt: new Date().toISOString(),
  })

  try {
    return persistSettings(settings)
  } catch (e) {
    const message = e instanceof Error ? e.message : '설정 파일 저장 실패'
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(message)
    }
    setGlobalCache({ settings, fileMtime: Date.now() })
    return settings
  }
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return password === 'admin'
  return password === expected
}
