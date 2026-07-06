import type { AppSettings, TimeBlock } from './types.js'

/** 관리자 UI 그리드 범위 */
export const GRID_DAY_START = 9
export const GRID_DAY_END = 21

export function parseTimeLabel(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function normalizeTimeBlock(block: TimeBlock): TimeBlock {
  return {
    start: formatMinutes(parseTimeLabel(block.start)),
    end: formatMinutes(parseTimeLabel(block.end)),
  }
}

export function blockKey(block: TimeBlock): string {
  const b = normalizeTimeBlock(block)
  return `${b.start}-${b.end}`
}

export function generateCandidateBlocks(slotMinutes: number): TimeBlock[] {
  const step = slotMinutes === 30 ? 30 : 60
  const start = GRID_DAY_START * 60
  const end = GRID_DAY_END * 60
  const blocks: TimeBlock[] = []

  for (let cursor = start; cursor + step <= end; cursor += step) {
    blocks.push({
      start: formatMinutes(cursor),
      end: formatMinutes(cursor + step),
    })
  }
  return blocks
}

export function migrateLegacySettings(raw: Partial<AppSettings>): TimeBlock[] {
  if (raw.timeBlocks && raw.timeBlocks.length > 0) {
    return normalizeTimeBlocks(raw.timeBlocks)
  }

  const openHour = raw.openHour ?? 9
  const closeHour = raw.closeHour ?? 16
  const slotMinutes = raw.slotMinutes === 30 ? 30 : 60
  const blocks: TimeBlock[] = []

  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += slotMinutes) {
      const total = h * 60 + m
      const closeTotal = closeHour * 60
      if (total + slotMinutes > closeTotal) break
      blocks.push({
        start: formatMinutes(total),
        end: formatMinutes(total + slotMinutes),
      })
    }
  }

  return blocks.length > 0 ? blocks : generateCandidateBlocks(60).slice(0, 7)
}

export function normalizeTimeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const seen = new Set<string>()
  const result: TimeBlock[] = []

  for (const block of blocks) {
    const normalized = normalizeTimeBlock(block)
    const start = parseTimeLabel(normalized.start)
    const end = parseTimeLabel(normalized.end)
    if (!(start < end)) continue
    const key = blockKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result.sort((a, b) => parseTimeLabel(a.start) - parseTimeLabel(b.start))
}

export function isRangeCoveredByBlocks(
  startTime: string,
  endTime: string,
  blocks: TimeBlock[],
): boolean {
  const startMin = parseTimeLabel(startTime)
  const endMin = parseTimeLabel(endTime)
  if (startMin >= endMin) return false

  const sorted = normalizeTimeBlocks(blocks)
  let cursor = startMin

  while (cursor < endMin) {
    const block = sorted.find((b) => parseTimeLabel(b.start) === cursor)
    if (!block) return false
    cursor = parseTimeLabel(block.end)
  }

  return cursor === endMin
}

export function formatTimeBlocksSummary(blocks: TimeBlock[]): string {
  const sorted = normalizeTimeBlocks(blocks)
  if (sorted.length === 0) return '설정된 시간 없음'
  if (sorted.length <= 3) {
    return sorted.map((b) => `${b.start}–${b.end}`).join(', ')
  }
  return `${sorted.length}개 시간대`
}

export function buildEndOptionsForStart(
  startTime: string,
  blocks: TimeBlock[],
): string[] {
  const sorted = normalizeTimeBlocks(blocks)
  const startIdx = sorted.findIndex((b) => b.start === startTime)
  if (startIdx < 0) return []

  const ends: string[] = []
  for (let i = startIdx; i < sorted.length; i++) {
    const prevEnd = i === startIdx ? null : parseTimeLabel(sorted[i - 1].end)
    const curStart = parseTimeLabel(sorted[i].start)
    if (prevEnd !== null && prevEnd !== curStart) break
    ends.push(sorted[i].end)
  }
  return ends
}

export function blockToIsoRange(dateIso: string, block: TimeBlock) {
  const b = normalizeTimeBlock(block)
  return {
    startAt: `${dateIso}T${b.start}:00.000+09:00`,
    endAt: `${dateIso}T${b.end}:00.000+09:00`,
  }
}
