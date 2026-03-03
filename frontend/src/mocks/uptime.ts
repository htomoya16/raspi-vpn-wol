import type { PcUptimeSummaryResponse, PcWeeklyTimelineResponse, UptimeBucket } from '../types/models'

function toIsoDateLocal(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDateLocal(value: string): Date | null {
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) {
    return null
  }
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  if (!year || !month || !day) {
    return null
  }
  return new Date(year, month - 1, day)
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date)
  return addDays(copy, -copy.getDay())
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6)
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31)
}

function seededValue(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function buildMockUptimeSummary(
  pcId: string,
  bucket: UptimeBucket,
  fromDate: string,
  toDate: string,
  tz = 'Asia/Tokyo',
): PcUptimeSummaryResponse {
  const from = parseIsoDateLocal(fromDate) || addDays(new Date(), -29)
  const to = parseIsoDateLocal(toDate) || new Date()
  const normalizedFrom = from <= to ? from : to
  const normalizedTo = to >= from ? to : from

  const points: Array<{
    label: string
    period_start: string
    period_end: string
    online_seconds: number
    online_ratio: number
  }> = []

  let cursor: Date
  if (bucket === 'day') {
    cursor = new Date(normalizedFrom)
    while (cursor <= normalizedTo) {
      const seed = cursor.getDate() + cursor.getMonth() * 37 + cursor.getFullYear() * 3
      const ratio = clamp(0.2 + seededValue(seed) * 0.62, 0.05, 0.92)
      const onlineSeconds = Math.round(86400 * ratio)
      const iso = toIsoDateLocal(cursor)
      points.push({
        label: iso,
        period_start: iso,
        period_end: iso,
        online_seconds: onlineSeconds,
        online_ratio: Number((onlineSeconds / 86400).toFixed(4)),
      })
      cursor = addDays(cursor, 1)
    }
  } else if (bucket === 'week') {
    cursor = startOfWeek(normalizedFrom)
    while (cursor <= normalizedTo) {
      const start = new Date(cursor)
      const end = endOfWeek(start)
      const seed = start.getDate() + start.getMonth() * 31 + start.getFullYear() * 7
      const ratio = clamp(0.3 + seededValue(seed) * 0.55, 0.08, 0.96)
      const totalSeconds = 7 * 86400
      const onlineSeconds = Math.round(totalSeconds * ratio)
      points.push({
        label: toIsoDateLocal(start),
        period_start: toIsoDateLocal(start),
        period_end: toIsoDateLocal(end),
        online_seconds: onlineSeconds,
        online_ratio: Number((onlineSeconds / totalSeconds).toFixed(4)),
      })
      cursor = addDays(cursor, 7)
    }
  } else if (bucket === 'month') {
    cursor = startOfMonth(normalizedFrom)
    while (cursor <= normalizedTo) {
      const start = new Date(cursor)
      const end = endOfMonth(start)
      const days = end.getDate()
      const totalSeconds = days * 86400
      const seed = start.getMonth() + start.getFullYear() * 11
      const ratio = clamp(0.32 + seededValue(seed) * 0.5, 0.08, 0.95)
      const onlineSeconds = Math.round(totalSeconds * ratio)
      points.push({
        label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        period_start: toIsoDateLocal(start),
        period_end: toIsoDateLocal(end),
        online_seconds: onlineSeconds,
        online_ratio: Number((onlineSeconds / totalSeconds).toFixed(4)),
      })
      cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    }
  } else {
    cursor = startOfYear(normalizedFrom)
    while (cursor <= normalizedTo) {
      const start = new Date(cursor)
      const end = endOfYear(start)
      const leap = new Date(start.getFullYear(), 1, 29).getMonth() === 1
      const totalSeconds = (leap ? 366 : 365) * 86400
      const seed = start.getFullYear() * 19
      const ratio = clamp(0.35 + seededValue(seed) * 0.45, 0.1, 0.93)
      const onlineSeconds = Math.round(totalSeconds * ratio)
      points.push({
        label: String(start.getFullYear()),
        period_start: toIsoDateLocal(start),
        period_end: toIsoDateLocal(end),
        online_seconds: onlineSeconds,
        online_ratio: Number((onlineSeconds / totalSeconds).toFixed(4)),
      })
      cursor = new Date(start.getFullYear() + 1, 0, 1)
    }
  }

  return {
    pc_id: pcId,
    from: toIsoDateLocal(normalizedFrom),
    to: toIsoDateLocal(normalizedTo),
    bucket,
    tz,
    items: points,
  }
}

function toHm(totalMinutes: number): string {
  const bounded = clamp(totalMinutes, 0, 24 * 60)
  const hour = Math.floor(bounded / 60)
  const minute = bounded % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function buildMockWeeklyTimeline(
  pcId: string,
  weekStart: string,
  tz = 'Asia/Tokyo',
): PcWeeklyTimelineResponse {
  const parsed = parseIsoDateLocal(weekStart) || startOfWeek(new Date())
  const normalizedWeekStart = startOfWeek(parsed)

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(normalizedWeekStart, index)
    const seed = date.getDate() + date.getMonth() * 31 + date.getFullYear() * 13
    const blockCount = 1 + Math.floor(seededValue(seed) * 3)

    const intervals = Array.from({ length: blockCount }).map((_, i) => {
      const base = seededValue(seed + i * 17)
      const startMinute = Math.floor((120 + base * 1080) / 30) * 30
      const tinyChance = seededValue(seed + i * 47)
      let durationMinute = 60 + Math.floor(seededValue(seed + i * 29) * 180)
      if (tinyChance < 0.22) {
        durationMinute = 1 + Math.floor(seededValue(seed + i * 59) * 11)
      }
      const endMinute = clamp(startMinute + durationMinute, 0, 24 * 60)
      const durationSeconds = Math.max(0, endMinute - startMinute) * 60
      return {
        start: toHm(startMinute),
        end: toHm(endMinute),
        duration_seconds: durationSeconds,
      }
    })

    const crossMidnightChance = seededValue(seed + 211)
    if (crossMidnightChance < 0.35) {
      const crossStartMinute = 22 * 60 + Math.floor(seededValue(seed + 223) * 120)
      const nextDayEndMinute = 10 + Math.floor(seededValue(seed + 241) * 130)
      const crossDurationSeconds = ((24 * 60 - crossStartMinute) + nextDayEndMinute) * 60
      intervals.push({
        start: toHm(crossStartMinute),
        end: toHm(nextDayEndMinute),
        duration_seconds: crossDurationSeconds,
      })
    }

    intervals.sort((a, b) => (a.start < b.start ? -1 : 1))
    const onlineSeconds = intervals.reduce((sum, item) => sum + item.duration_seconds, 0)
    return {
      date: toIsoDateLocal(date),
      online_seconds: onlineSeconds,
      intervals,
    }
  })

  return {
    pc_id: pcId,
    week_start: toIsoDateLocal(normalizedWeekStart),
    week_end: toIsoDateLocal(addDays(normalizedWeekStart, 6)),
    tz,
    days,
  }
}
