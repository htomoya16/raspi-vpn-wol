import type {
  PcUptimeSummaryResponse,
  PcWeeklyTimelineResponse,
  UptimeBucket,
  UptimeSummaryItem,
  UptimeWeeklyInterval,
} from '../../types/models'
import type { IntervalDisplayMode, SummaryBucket, SummaryAxisTick, TimelineDay, TimelineInterval } from './types'

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

const DATE_RANGE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const HOUR_MARKERS = Array.from({ length: 25 }, (_, hour) => hour)

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function toIsoDateLocal(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseIsoDateLocal(value: string): Date | null {
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

export function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

export function addMonths(base: Date, months: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + months, 1)
}

export function addYears(base: Date, years: number): Date {
  return new Date(base.getFullYear() + years, 0, 1)
}

export function startOfWeekSunday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(copy, -copy.getDay())
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31)
}

export function getCurrentWeekStart(): string {
  return toIsoDateLocal(startOfWeekSunday(new Date()))
}

export function formatSecondsToHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`
}

export function formatSecondsToAxisHours(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 100) {
    return `${Math.round(hours)}h`
  }
  return `${hours.toFixed(1)}h`
}

export function toBucketedMaxSeconds(seconds: number, bucket: SummaryBucket): number {
  const hours = seconds / 3600
  if (bucket === 'month') {
    return Math.max(100, Math.ceil(hours / 100) * 100) * 3600
  }
  if (bucket === 'year') {
    return Math.max(1000, Math.ceil(hours / 1000) * 1000) * 3600
  }
  const evenHours = Math.max(2, Math.ceil(hours / 2) * 2)
  return evenHours * 3600
}

export function formatWeekDayLabel(value: string): string {
  const parsed = parseIsoDateLocal(value)
  if (!parsed) {
    return value
  }
  return WEEKDAY_FORMATTER.format(parsed)
}

export function toMinuteOfDay(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':')
  const h = Number(hour)
  const m = Number(minute)
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return 0
  }
  return Math.max(0, Math.min(24 * 60, h * 60 + m))
}

export function intervalToVertical(interval: UptimeWeeklyInterval): { top: number; height: number } {
  const start = toMinuteOfDay(interval.start)
  let end = toMinuteOfDay(interval.end)
  if (end <= start) {
    end = 24 * 60
  }
  const top = (start / (24 * 60)) * 100
  const height = Math.max(((end - start) / (24 * 60)) * 100, 1)
  return { top, height }
}

export function getIntervalDisplayMode(durationSeconds: number): IntervalDisplayMode {
  if (durationSeconds <= 10 * 60) {
    return 'minimal'
  }
  if (durationSeconds <= 78 * 60) {
    return 'compact'
  }
  return 'full'
}

export function getSummaryQuery(anchor: Date, bucket: SummaryBucket): {
  from: string
  to: string
  apiBucket: UptimeBucket
} {
  if (bucket === 'day') {
    const weekStart = startOfWeekSunday(anchor)
    const weekEnd = addDays(weekStart, 6)
    return {
      from: toIsoDateLocal(weekStart),
      to: toIsoDateLocal(weekEnd),
      apiBucket: 'day',
    }
  }

  if (bucket === 'month') {
    const endMonth = startOfMonth(anchor)
    const startMonth = addMonths(endMonth, -11)
    return {
      from: toIsoDateLocal(startOfMonth(startMonth)),
      to: toIsoDateLocal(endOfMonth(endMonth)),
      apiBucket: 'month',
    }
  }

  const endYearDate = startOfYear(anchor)
  const startYearDate = addYears(endYearDate, -4)
  return {
    from: toIsoDateLocal(startOfYear(startYearDate)),
    to: toIsoDateLocal(endOfYear(endYearDate)),
    apiBucket: 'year',
  }
}

export function moveSummaryAnchor(base: Date, bucket: SummaryBucket, direction: 1 | -1): Date {
  if (bucket === 'day') {
    return addDays(base, direction * 7)
  }
  if (bucket === 'month') {
    return addMonths(base, direction)
  }
  return addYears(base, direction)
}

export function canMoveSummaryNext(anchor: Date, bucket: SummaryBucket): boolean {
  const today = new Date()
  if (bucket === 'day') {
    const end = addDays(startOfWeekSunday(anchor), 6)
    return end < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }
  if (bucket === 'month') {
    return startOfMonth(anchor) < startOfMonth(today)
  }
  return startOfYear(anchor) < startOfYear(today)
}

export function formatSummaryLabel(item: UptimeSummaryItem, bucket: SummaryBucket): string {
  if (bucket !== 'day') {
    return item.label
  }
  const date = parseIsoDateLocal(item.period_start)
  if (!date) {
    return item.label
  }
  return WEEKDAY_FORMATTER.format(date)
}

export function formatDateRange(from: string, to: string): string {
  const fromDate = parseIsoDateLocal(from)
  const toDate = parseIsoDateLocal(to)
  if (!fromDate || !toDate) {
    return `${from} - ${to}`
  }
  return `${DATE_RANGE_FORMATTER.format(fromDate)} - ${DATE_RANGE_FORMATTER.format(toDate)}`
}

export function buildWeeklyFallback(start: string, defaultTz: string): PcWeeklyTimelineResponse {
  const base = parseIsoDateLocal(start) || startOfWeekSunday(new Date())
  const weekStart = startOfWeekSunday(base)
  const days = Array.from({ length: 7 }).map((_, index) => ({
    date: toIsoDateLocal(addDays(weekStart, index)),
    online_seconds: 0,
    intervals: [],
  }))
  return {
    pc_id: '',
    week_start: toIsoDateLocal(weekStart),
    week_end: toIsoDateLocal(addDays(weekStart, 6)),
    tz: defaultTz,
    days,
  }
}

export function buildTimelineDays(days: PcWeeklyTimelineResponse['days']): TimelineDay[] {
  const timelineDays: TimelineDay[] = days.map((day) => ({
    date: day.date,
    online_seconds: 0,
    intervals: [],
  }))

  days.forEach((day, dayIndex) => {
    day.intervals.forEach((interval, intervalIndex) => {
      const startMinute = toMinuteOfDay(interval.start)
      const endMinute = toMinuteOfDay(interval.end)

      if (endMinute > startMinute) {
        const sameDayInterval: TimelineInterval = {
          ...interval,
          key: `${day.date}-normal-${interval.start}-${interval.end}-${intervalIndex}`,
        }
        timelineDays[dayIndex].intervals.push(sameDayInterval)
        timelineDays[dayIndex].online_seconds += interval.duration_seconds
        return
      }

      const todayDurationSeconds = Math.max(0, (24 * 60 - startMinute) * 60)
      if (todayDurationSeconds > 0) {
        timelineDays[dayIndex].intervals.push({
          start: interval.start,
          end: '24:00',
          duration_seconds: todayDurationSeconds,
          key: `${day.date}-split-today-${interval.start}-${interval.end}-${intervalIndex}`,
        })
        timelineDays[dayIndex].online_seconds += todayDurationSeconds
      }

      const nextDayDurationSeconds = Math.max(0, endMinute * 60)
      if (nextDayDurationSeconds > 0 && dayIndex + 1 < timelineDays.length) {
        timelineDays[dayIndex + 1].intervals.push({
          start: '00:00',
          end: interval.end,
          duration_seconds: nextDayDurationSeconds,
          key: `${day.date}-split-next-${interval.start}-${interval.end}-${intervalIndex}`,
        })
        timelineDays[dayIndex + 1].online_seconds += nextDayDurationSeconds
      }
    })
  })

  timelineDays.forEach((day) => {
    day.intervals.sort((a, b) => toMinuteOfDay(a.start) - toMinuteOfDay(b.start))
  })

  return timelineDays
}

export function buildSummaryAxisTicks(summaryMaxSeconds: number): SummaryAxisTick[] {
  return Array.from({ length: 5 }).map((_, index) => {
    const ratio = index / 4
    const value = summaryMaxSeconds * ratio
    return {
      key: `tick-${index}`,
      ratio,
      value,
      label: formatSecondsToAxisHours(value),
      isMin: index === 0,
      isMax: index === 4,
    }
  })
}
