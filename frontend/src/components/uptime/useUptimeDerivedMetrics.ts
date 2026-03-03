import { useMemo, type CSSProperties } from 'react'

import type { PcUptimeSummaryResponse, PcWeeklyTimelineResponse, UptimeSummaryItem } from '../../types/models'
import type { SummaryAxisTick, SummaryBucket, TimelineDay } from './types'
import { buildSummaryAxisTicks, buildTimelineDays, buildWeeklyFallback, parseIsoDateLocal, toBucketedMaxSeconds } from './utils'

interface UseUptimeDerivedMetricsInput {
  summary: PcUptimeSummaryResponse | null
  weekly: PcWeeklyTimelineResponse | null
  weekStart: string
  summaryBucket: SummaryBucket
  isMobile: boolean
  mobileCursorDate: string
  todayIsoDate: string
  weekStartDate: Date
  currentWeekStartDate: Date
  tz: string
}

interface UseUptimeDerivedMetricsResult {
  summaryItems: UptimeSummaryItem[]
  summaryMaxSeconds: number
  summaryAverageSeconds: number
  summaryAveragePercent: number
  summaryAxisTicks: SummaryAxisTick[]
  summaryGridStyle: CSSProperties
  weeklyData: PcWeeklyTimelineResponse
  timelineDays: TimelineDay[]
  visibleTimelineDays: TimelineDay[]
  activeTimelineDay: TimelineDay | null
  isWeeklyNextDisabled: boolean
  isTimelineNextDisabled: boolean
}

export function useUptimeDerivedMetrics({
  summary,
  weekly,
  weekStart,
  summaryBucket,
  isMobile,
  mobileCursorDate,
  todayIsoDate,
  weekStartDate,
  currentWeekStartDate,
  tz,
}: UseUptimeDerivedMetricsInput): UseUptimeDerivedMetricsResult {
  const summaryItems = useMemo(
    () => (summary ? [...summary.items].sort((a, b) => a.period_start.localeCompare(b.period_start)) : []),
    [summary],
  )

  const summaryMaxSeconds = useMemo(() => {
    const maxSeconds = summaryItems.length === 0 ? 0 : Math.max(...summaryItems.map((item) => item.online_seconds))
    return toBucketedMaxSeconds(maxSeconds, summaryBucket)
  }, [summaryBucket, summaryItems])

  const summaryAverageSeconds = useMemo(() => {
    if (summaryItems.length === 0) {
      return 0
    }
    const total = summaryItems.reduce((sum, item) => sum + item.online_seconds, 0)
    return total / summaryItems.length
  }, [summaryItems])

  const summaryAveragePercent = useMemo(() => {
    if (summaryMaxSeconds <= 0) {
      return 0
    }
    return Math.max(0, Math.min(100, (summaryAverageSeconds / summaryMaxSeconds) * 100))
  }, [summaryAverageSeconds, summaryMaxSeconds])

  const summaryAxisTicks = useMemo(() => buildSummaryAxisTicks(summaryMaxSeconds), [summaryMaxSeconds])

  const summaryColumnMinWidth = useMemo(() => {
    if (isMobile) {
      return 0
    }
    if (summaryBucket === 'month') {
      return 64
    }
    if (summaryBucket === 'year') {
      return 90
    }
    return 76
  }, [isMobile, summaryBucket])

  const summaryGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(summaryItems.length, 1)}, minmax(${summaryColumnMinWidth}px, 1fr))`,
    }),
    [summaryColumnMinWidth, summaryItems.length],
  )

  const weeklyData = useMemo(() => weekly || buildWeeklyFallback(weekStart, tz), [tz, weekStart, weekly])
  const timelineDays = useMemo(() => buildTimelineDays(weeklyData.days), [weeklyData.days])

  const visibleTimelineDays = useMemo(() => {
    if (!isMobile) {
      return timelineDays
    }
    if (timelineDays.length === 0) {
      return []
    }
    const cursorIndex = timelineDays.findIndex((day) => day.date === mobileCursorDate)
    if (cursorIndex >= 0) {
      return [timelineDays[cursorIndex]]
    }
    if (mobileCursorDate <= timelineDays[0].date) {
      return [timelineDays[0]]
    }
    return [timelineDays[timelineDays.length - 1]]
  }, [isMobile, mobileCursorDate, timelineDays])

  const activeTimelineDay = useMemo(() => {
    if (visibleTimelineDays.length === 0) {
      return null
    }
    return visibleTimelineDays[0]
  }, [visibleTimelineDays])

  const isWeeklyNextDisabled = weekStartDate >= currentWeekStartDate

  const isTimelineNextDisabled = useMemo(() => {
    if (!isMobile) {
      return isWeeklyNextDisabled
    }
    if (timelineDays.length === 0) {
      return true
    }
    const activeDate = activeTimelineDay?.date || mobileCursorDate
    const activeDateObj = parseIsoDateLocal(activeDate)
    if (!activeDateObj) {
      return true
    }
    return activeDate >= todayIsoDate
  }, [activeTimelineDay?.date, isMobile, isWeeklyNextDisabled, mobileCursorDate, timelineDays.length, todayIsoDate])

  return {
    summaryItems,
    summaryMaxSeconds,
    summaryAverageSeconds,
    summaryAveragePercent,
    summaryAxisTicks,
    summaryGridStyle,
    weeklyData,
    timelineDays,
    visibleTimelineDays,
    activeTimelineDay,
    isWeeklyNextDisabled,
    isTimelineNextDisabled,
  }
}
