const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeBlockedDates(dates?: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of dates ?? []) {
    if (!DATE_ISO_RE.test(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result.sort()
}

export function isBlockedDate(dateIso: string, blockedDates?: string[]): boolean {
  return normalizeBlockedDates(blockedDates).includes(dateIso)
}
