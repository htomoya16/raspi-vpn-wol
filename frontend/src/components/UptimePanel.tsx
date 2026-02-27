import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'

import { formatApiError } from '../api/http'
import { getPcUptimeSummary, getPcWeeklyTimeline } from '../api/pcs'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { buildMockUptimeSummary, buildMockWeeklyTimeline } from '../mocks/uptime'
import type {
  Pc,
  PcUptimeSummaryResponse,
  PcWeeklyTimelineResponse,
  UptimeBucket,
  UptimeSummaryItem,
  UptimeWeeklyInterval,
} from '../types/models'
import LoadingDots from './LoadingDots'

const DEFAULT_TZ = 'Asia/Tokyo'
const ENABLE_UPTIME_MOCK = Boolean(import.meta.env.DEV)

type SummaryBucket = 'day' | 'month' | 'year'
type SlideDirection = 'prev' | 'next' | null
interface TimelineInterval extends UptimeWeeklyInterval {
  key: string
}

interface TimelineDay {
  date: string
  online_seconds: number
  intervals: TimelineInterval[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface UptimePanelProps {
  pcs: Pc[]
  selectedPcId: string
  onSelectPc: (pcId: string) => void
  dataVersion?: string
  embedded?: boolean
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

const MD_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
})

const DATE_RANGE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const HOUR_MARKERS = Array.from({ length: 25 }, (_, hour) => hour)
const SWIPE_THRESHOLD_PX = 44
const SWIPE_MAX_VERTICAL_PX = 60

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

function addMonths(base: Date, months: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + months, 1)
}

function addYears(base: Date, years: number): Date {
  return new Date(base.getFullYear() + years, 0, 1)
}

function startOfWeekSunday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(copy, -copy.getDay())
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

function getCurrentWeekStart(): string {
  return toIsoDateLocal(startOfWeekSunday(new Date()))
}

function formatSecondsToHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatSecondsToAxisHours(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 100) {
    return `${Math.round(hours)}h`
  }
  return `${hours.toFixed(1)}h`
}

function toBucketedMaxSeconds(seconds: number, bucket: SummaryBucket): number {
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

function formatWeekDayLabel(value: string): string {
  const parsed = parseIsoDateLocal(value)
  if (!parsed) {
    return value
  }
  return WEEKDAY_FORMATTER.format(parsed)
}

function toMinuteOfDay(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':')
  const h = Number(hour)
  const m = Number(minute)
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return 0
  }
  return Math.max(0, Math.min(24 * 60, h * 60 + m))
}

function intervalToVertical(interval: UptimeWeeklyInterval): { top: number; height: number } {
  const start = toMinuteOfDay(interval.start)
  let end = toMinuteOfDay(interval.end)
  if (end <= start) {
    end = 24 * 60
  }
  const top = (start / (24 * 60)) * 100
  const height = Math.max(((end - start) / (24 * 60)) * 100, 1)
  return { top, height }
}

type IntervalDisplayMode = 'full' | 'compact' | 'minimal'

function getIntervalDisplayMode(durationSeconds: number): IntervalDisplayMode {
  if (durationSeconds <= 10 * 60) {
    return 'minimal'
  }
  if (durationSeconds <= 78 * 60) {
    return 'compact'
  }
  return 'full'
}

function getSummaryQuery(anchor: Date, bucket: SummaryBucket): {
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

function moveSummaryAnchor(base: Date, bucket: SummaryBucket, direction: 1 | -1): Date {
  if (bucket === 'day') {
    return addDays(base, direction * 7)
  }
  if (bucket === 'month') {
    return addMonths(base, direction)
  }
  return addYears(base, direction)
}

function canMoveSummaryNext(anchor: Date, bucket: SummaryBucket): boolean {
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

function formatSummaryLabel(item: UptimeSummaryItem, bucket: SummaryBucket): string {
  if (bucket !== 'day') {
    return item.label
  }
  const date = parseIsoDateLocal(item.period_start)
  if (!date) {
    return item.label
  }
  return WEEKDAY_FORMATTER.format(date)
}

function formatDateRange(from: string, to: string): string {
  const fromDate = parseIsoDateLocal(from)
  const toDate = parseIsoDateLocal(to)
  if (!fromDate || !toDate) {
    return `${from} - ${to}`
  }
  return `${DATE_RANGE_FORMATTER.format(fromDate)} - ${DATE_RANGE_FORMATTER.format(toDate)}`
}

function buildWeeklyFallback(start: string): PcWeeklyTimelineResponse {
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
    tz: DEFAULT_TZ,
    days,
  }
}

function buildTimelineDays(days: PcWeeklyTimelineResponse['days']): TimelineDay[] {
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
        timelineDays[dayIndex].intervals.push({
          ...interval,
          key: `${day.date}-normal-${interval.start}-${interval.end}-${intervalIndex}`,
        })
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

function UptimePanel({
  pcs,
  selectedPcId,
  onSelectPc,
  dataVersion = '',
  embedded = false,
}: UptimePanelProps) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const [summaryBucket, setSummaryBucket] = useState<SummaryBucket>('day')
  const [summaryAnchor, setSummaryAnchor] = useState<Date>(() => new Date())
  const [summarySlide, setSummarySlide] = useState<SlideDirection>(null)
  const pendingSummarySlideRef = useRef<SlideDirection>(null)

  const [weekStart, setWeekStart] = useState(getCurrentWeekStart)
  const [weeklySlide, setWeeklySlide] = useState<SlideDirection>(null)
  const pendingWeeklySlideRef = useRef<SlideDirection>(null)
  const summaryTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const timelineTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [mobileDayIndex, setMobileDayIndex] = useState(() => new Date().getDay())
  const pendingMobileDayIndexRef = useRef<number | null>(null)
  const previousWeekStartRef = useRef('')

  const [useMockData, setUseMockData] = useState<boolean>(() => {
    if (!ENABLE_UPTIME_MOCK) {
      return false
    }
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('uptime:mock') === '1'
  })

  const [summary, setSummary] = useState<PcUptimeSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const [weekly, setWeekly] = useState<PcWeeklyTimelineResponse | null>(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState('')
  const previousActivePcIdRef = useRef('')

  function flushSummarySlideIfNeeded(): void {
    const pending = pendingSummarySlideRef.current
    if (!pending || typeof window === 'undefined') {
      return
    }
    pendingSummarySlideRef.current = null
    setSummarySlide(null)
    window.requestAnimationFrame(() => {
      setSummarySlide(pending)
    })
  }

  function flushWeeklySlideIfNeeded(): void {
    const pending = pendingWeeklySlideRef.current
    if (!pending || typeof window === 'undefined') {
      return
    }
    pendingWeeklySlideRef.current = null
    setWeeklySlide(null)
    window.requestAnimationFrame(() => {
      setWeeklySlide(pending)
    })
  }

  const activePcId = useMemo(() => {
    if (pcs.length === 0) {
      return ''
    }
    if (selectedPcId && pcs.some((pc) => pc.id === selectedPcId)) {
      return selectedPcId
    }
    return pcs[0].id
  }, [pcs, selectedPcId])

  const currentWeekStart = useMemo(() => getCurrentWeekStart(), [])
  const currentWeekStartDate = useMemo(
    () => parseIsoDateLocal(currentWeekStart) || startOfWeekSunday(new Date()),
    [currentWeekStart],
  )

  const weekStartDate = useMemo(
    () => parseIsoDateLocal(weekStart) || currentWeekStartDate,
    [currentWeekStartDate, weekStart],
  )

  const isWeeklyNextDisabled = weekStartDate >= currentWeekStartDate

  const summaryQuery = useMemo(
    () => getSummaryQuery(summaryAnchor, summaryBucket),
    [summaryAnchor, summaryBucket],
  )

  const isSummaryNextDisabled = useMemo(
    () => !canMoveSummaryNext(summaryAnchor, summaryBucket),
    [summaryAnchor, summaryBucket],
  )

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

  const summaryAxisTicks = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, index) => {
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
      }),
    [summaryMaxSeconds],
  )

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

  const summaryGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(summaryItems.length, 1)}, minmax(${summaryColumnMinWidth}px, 1fr))`,
    }),
    [summaryColumnMinWidth, summaryItems.length],
  )

  useEffect(() => {
    if (!activePcId) {
      previousActivePcIdRef.current = ''
      return
    }
    const previousPcId = previousActivePcIdRef.current
    if (previousPcId && previousPcId !== activePcId) {
      pendingSummarySlideRef.current = 'next'
      pendingWeeklySlideRef.current = 'next'
      setSummaryBucket('day')
      setSummaryAnchor(new Date())
    }
    previousActivePcIdRef.current = activePcId
  }, [activePcId])

  useEffect(() => {
    let cancelled = false

    async function runSummaryFlow() {
      if (!activePcId) {
        pendingSummarySlideRef.current = null
        if (!cancelled) {
          setSummary(null)
          setSummaryError('')
          setSummaryLoading(false)
        }
        return
      }

      const { from, to, apiBucket } = summaryQuery

      if (ENABLE_UPTIME_MOCK && useMockData) {
        if (!cancelled) {
          setSummary(buildMockUptimeSummary(activePcId, apiBucket, from, to, DEFAULT_TZ))
          setSummaryError('')
          setSummaryLoading(false)
          flushSummarySlideIfNeeded()
        }
        return
      }

      if (!cancelled) {
        setSummaryLoading(true)
        setSummaryError('')
      }

      try {
        const data = await getPcUptimeSummary(activePcId, {
          from,
          to,
          bucket: apiBucket,
          tz: DEFAULT_TZ,
        })
        if (!cancelled) {
          setSummary(data)
        }
      } catch (error) {
        pendingSummarySlideRef.current = null
        if (!cancelled) {
          setSummary(null)
          setSummaryError(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
          flushSummarySlideIfNeeded()
        }
      }
    }

    void runSummaryFlow()
    return () => {
      cancelled = true
    }
  }, [activePcId, dataVersion, summaryQuery, useMockData])

  useEffect(() => {
    let cancelled = false

    async function runWeeklyFlow() {
      if (!activePcId) {
        pendingWeeklySlideRef.current = null
        if (!cancelled) {
          setWeekly(null)
          setWeeklyError('')
          setWeeklyLoading(false)
        }
        return
      }

      if (ENABLE_UPTIME_MOCK && useMockData) {
        if (!cancelled) {
          setWeekly(buildMockWeeklyTimeline(activePcId, weekStart, DEFAULT_TZ))
          setWeeklyError('')
          setWeeklyLoading(false)
          flushWeeklySlideIfNeeded()
        }
        return
      }

      if (!cancelled) {
        setWeeklyLoading(true)
        setWeeklyError('')
      }

      try {
        const data = await getPcWeeklyTimeline(activePcId, {
          week_start: weekStart,
          tz: DEFAULT_TZ,
        })
        if (!cancelled) {
          setWeekly(data)
        }
      } catch (error) {
        pendingWeeklySlideRef.current = null
        if (!cancelled) {
          setWeekly(null)
          setWeeklyError(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setWeeklyLoading(false)
          flushWeeklySlideIfNeeded()
        }
      }
    }

    void runWeeklyFlow()
    return () => {
      cancelled = true
    }
  }, [activePcId, dataVersion, useMockData, weekStart])

  useEffect(() => {
    if (!summarySlide) {
      return undefined
    }
    const timer = window.setTimeout(() => setSummarySlide(null), 300)
    return () => window.clearTimeout(timer)
  }, [summarySlide])

  useEffect(() => {
    if (!weeklySlide) {
      return undefined
    }
    const timer = window.setTimeout(() => setWeeklySlide(null), 300)
    return () => window.clearTimeout(timer)
  }, [weeklySlide])

  function handleToggleMockData() {
    if (!ENABLE_UPTIME_MOCK) {
      return
    }
    setUseMockData((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('uptime:mock', next ? '1' : '0')
      }
      return next
    })
  }

  function moveSummary(direction: 1 | -1): void {
    pendingSummarySlideRef.current = direction < 0 ? 'prev' : 'next'
    setSummaryAnchor((prev) => moveSummaryAnchor(prev, summaryBucket, direction))
  }

  function moveWeekly(offset: number): void {
    pendingWeeklySlideRef.current = offset < 0 ? 'prev' : 'next'
    const base = parseIsoDateLocal(weekStart) || weekStartDate
    setWeekStart(toIsoDateLocal(addDays(base, offset * 7)))
  }

  const weeklyData = weekly || buildWeeklyFallback(weekStart)
  const timelineDays = useMemo(() => buildTimelineDays(weeklyData.days), [weeklyData.days])
  const visibleTimelineDays = useMemo(() => {
    if (!isMobile) {
      return timelineDays
    }
    if (timelineDays.length === 0) {
      return []
    }
    return [timelineDays[clamp(mobileDayIndex, 0, timelineDays.length - 1)]]
  }, [isMobile, mobileDayIndex, timelineDays])
  const activeTimelineDay = useMemo(() => {
    if (visibleTimelineDays.length === 0) {
      return null
    }
    return visibleTimelineDays[0]
  }, [visibleTimelineDays])

  useEffect(() => {
    if (!isMobile) {
      return
    }
    if (timelineDays.length === 0) {
      setMobileDayIndex(0)
      return
    }

    const pending = pendingMobileDayIndexRef.current
    if (pending !== null) {
      pendingMobileDayIndexRef.current = null
      setMobileDayIndex(clamp(pending, 0, timelineDays.length - 1))
      return
    }

    if (previousWeekStartRef.current === weekStart) {
      setMobileDayIndex((prev) => clamp(prev, 0, timelineDays.length - 1))
      return
    }

    previousWeekStartRef.current = weekStart
    const nextIndex = weekStart === currentWeekStart ? new Date().getDay() : 0
    setMobileDayIndex(clamp(nextIndex, 0, timelineDays.length - 1))
  }, [currentWeekStart, isMobile, timelineDays, weekStart])

  const isTimelineNextDisabled = useMemo(() => {
    if (!isMobile) {
      return isWeeklyNextDisabled
    }
    const isLastDay = mobileDayIndex >= timelineDays.length - 1
    return isLastDay && isWeeklyNextDisabled
  }, [isMobile, isWeeklyNextDisabled, mobileDayIndex, timelineDays.length])

  function moveTimeline(direction: 1 | -1): void {
    if (!isMobile) {
      moveWeekly(direction)
      return
    }

    const nextIndex = mobileDayIndex + direction
    if (nextIndex >= 0 && nextIndex < timelineDays.length) {
      setWeeklySlide(direction < 0 ? 'prev' : 'next')
      setMobileDayIndex(nextIndex)
      return
    }

    if (direction < 0) {
      pendingMobileDayIndexRef.current = 6
      moveWeekly(-1)
      return
    }

    if (isWeeklyNextDisabled) {
      return
    }

    pendingMobileDayIndexRef.current = 0
    moveWeekly(1)
  }

  function handleSummaryTouchStart(event: TouchEvent<HTMLDivElement>): void {
    if (!isMobile) {
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    summaryTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleSummaryTouchEnd(event: TouchEvent<HTMLDivElement>): void {
    const start = summaryTouchStartRef.current
    summaryTouchStartRef.current = null
    if (!isMobile || !start) {
      return
    }
    const touch = event.changedTouches[0]
    if (!touch) {
      return
    }
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaY) > SWIPE_MAX_VERTICAL_PX) {
      return
    }
    if (deltaX > 0) {
      moveSummary(-1)
      return
    }
    if (!isSummaryNextDisabled) {
      moveSummary(1)
    }
  }

  function handleTimelineTouchStart(event: TouchEvent<HTMLDivElement>): void {
    if (!isMobile) {
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    timelineTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTimelineTouchEnd(event: TouchEvent<HTMLDivElement>): void {
    const start = timelineTouchStartRef.current
    timelineTouchStartRef.current = null
    if (!isMobile || !start) {
      return
    }
    const touch = event.changedTouches[0]
    if (!touch) {
      return
    }
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaY) > SWIPE_MAX_VERTICAL_PX) {
      return
    }
    if (deltaX > 0) {
      moveTimeline(-1)
      return
    }
    moveTimeline(1)
  }

  const content = (
    <>
      <div className="panel__header">
        <h2>稼働時間</h2>
        <p>オンライン集計と稼働タイムラインを確認できます。</p>
      </div>

      {pcs.length === 0 ? (
        <p className="empty-state">PCがまだ登録されていません。</p>
      ) : (
        <>
          <div className="uptime-toolbar">
            <label>
              対象PC
              <select
                value={activePcId}
                onChange={(event) => {
                  const nextPcId = event.target.value
                  if (nextPcId !== activePcId) {
                    pendingSummarySlideRef.current = 'next'
                    pendingWeeklySlideRef.current = 'next'
                  }
                  onSelectPc(nextPcId)
                }}
              >
                {pcs.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.name} ({pc.id})
                  </option>
                ))}
              </select>
            </label>

            <label>
              集計単位
              <select
                value={summaryBucket}
                onChange={(event) => {
                  pendingSummarySlideRef.current = 'next'
                  setSummaryBucket(event.target.value as SummaryBucket)
                  setSummaryAnchor(new Date())
                }}
              >
                <option value="day">日次</option>
                <option value="month">月次</option>
                <option value="year">年次</option>
              </select>
            </label>

            {ENABLE_UPTIME_MOCK ? (
              <button
                type="button"
                className={`btn ${useMockData ? 'btn--primary' : 'btn--soft'} uptime-toolbar__mock-toggle`}
                onClick={handleToggleMockData}
              >
                {useMockData ? 'モック表示: ON' : 'モック表示: OFF'}
              </button>
            ) : null}
          </div>

          <section className="uptime-section">
            <header className="uptime-section__header uptime-section__header--with-nav">
              <div>
                <h3>オンライン集計グラフ</h3>
                <p>{formatDateRange(summaryQuery.from, summaryQuery.to)}</p>
              </div>

              {!isMobile ? (
                <div className="uptime-nav uptime-nav--summary" aria-label="オンライン集計の移動">
                  <button
                    type="button"
                    className="btn btn--soft uptime-nav__arrow"
                    onClick={() => moveSummary(-1)}
                    aria-label="オンライン集計を前へ"
                  >
                    <span className="uptime-nav__glyph" aria-hidden="true">
                      {'<'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft uptime-nav__arrow"
                    onClick={() => moveSummary(1)}
                    disabled={isSummaryNextDisabled}
                    aria-label="オンライン集計を次へ"
                  >
                    <span className="uptime-nav__glyph" aria-hidden="true">
                      {'>'}
                    </span>
                  </button>
                </div>
              ) : null}
            </header>

            {!summaryLoading && summaryError ? <p className="feedback feedback--error">{summaryError}</p> : null}

            {!summaryError ? (
              <div
                className="uptime-section__content uptime-section__content--summary"
                onTouchStart={handleSummaryTouchStart}
                onTouchEnd={handleSummaryTouchEnd}
                onTouchCancel={() => {
                  summaryTouchStartRef.current = null
                }}
              >
                {summaryItems.length > 0 ? (
                  <div className={`uptime-slide-surface ${summarySlide ? `uptime-slide-surface--${summarySlide}` : ''}`}>
                    <div className={`uptime-chart uptime-chart--${summaryBucket}`}>
                      <div className="uptime-chart__axis" aria-hidden="true">
                        {summaryAxisTicks.map((tick) => (
                          <span
                            key={tick.key}
                            className={`uptime-chart__axis-label ${tick.isMin ? 'uptime-chart__axis-label--min' : ''} ${tick.isMax ? 'uptime-chart__axis-label--max' : ''}`.trim()}
                            style={{ top: `${(1 - tick.ratio) * 100}%` }}
                          >
                            {tick.label}
                          </span>
                        ))}
                      </div>

                      <div className="uptime-chart__main">
                        <div className="uptime-chart__scroller">
                          <div className="uptime-chart__plot">
                            <span className="uptime-chart__avg-line" style={{ bottom: `${summaryAveragePercent}%` }}>
                              <span className="uptime-chart__avg-label">
                                平均 {formatSecondsToAxisHours(summaryAverageSeconds)}
                              </span>
                            </span>

                            <div className="uptime-chart__bars" style={summaryGridStyle}>
                              {summaryItems.map((item, index) => (
                                <div key={`${item.period_start}-${item.period_end}`} className="uptime-chart__bar-cell">
                                  <div className="uptime-chart__bar-wrap">
                                    <div
                                      className={`uptime-chart__bar ${
                                        summarySlide
                                          ? `uptime-chart__bar--grow uptime-chart__bar--grow-${summarySlide}`
                                          : ''
                                      }`.trim()}
                                      style={{
                                        height: `${item.online_seconds <= 0 ? 0 : Math.max((item.online_seconds / summaryMaxSeconds) * 100, 2)}%`,
                                        animationDelay: summarySlide ? `${Math.min(index, 24) * 22}ms` : undefined,
                                      }}
                                      title={`${item.label}: ${formatSecondsToHours(item.online_seconds)} (${Math.round(item.online_ratio * 100)}%)`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="uptime-chart__meta" style={summaryGridStyle}>
                            {summaryItems.map((item) => (
                              <div key={`meta-${item.period_start}-${item.period_end}`} className="uptime-chart__meta-item">
                                <p className="uptime-chart__label">{formatSummaryLabel(item, summaryBucket)}</p>
                                <p className="uptime-chart__value">{formatSecondsToHours(item.online_seconds)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="uptime-summary-placeholder">
                    <p className="empty-state">集計データがありません。</p>
                  </div>
                )}

                {summaryLoading ? (
                  <div className="uptime-loading-overlay">
                    <LoadingDots label="集計データを読み込み中です" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="uptime-section">
            <header className="uptime-section__header uptime-section__header--with-nav">
              <div>
                <h3>稼働タイムライン</h3>
                <p>
                  {isMobile && activeTimelineDay
                    ? `${formatWeekDayLabel(activeTimelineDay.date)} / ${weeklyData.week_start} - ${weeklyData.week_end}`
                    : `${weeklyData.week_start} - ${weeklyData.week_end}`}
                </p>
              </div>

              {!isMobile ? (
                <div className="uptime-nav uptime-nav--weekly" aria-label="稼働タイムラインの移動">
                  <button
                    type="button"
                    className="btn btn--soft uptime-nav__arrow"
                    onClick={() => moveTimeline(-1)}
                    aria-label="稼働タイムラインを前へ"
                  >
                    <span className="uptime-nav__glyph" aria-hidden="true">
                      {'<'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft uptime-nav__arrow"
                    onClick={() => moveTimeline(1)}
                    disabled={isTimelineNextDisabled}
                    aria-label="稼働タイムラインを次へ"
                  >
                    <span className="uptime-nav__glyph" aria-hidden="true">
                      {'>'}
                    </span>
                  </button>
                </div>
              ) : null}
            </header>

            {!weeklyLoading && weeklyError ? <p className="feedback feedback--error">{weeklyError}</p> : null}

            {!weeklyError ? (
              <div
                className="uptime-section__content uptime-section__content--weekly"
                onTouchStart={handleTimelineTouchStart}
                onTouchEnd={handleTimelineTouchEnd}
                onTouchCancel={() => {
                  timelineTouchStartRef.current = null
                }}
              >
                <div className={`uptime-slide-surface ${weeklySlide ? `uptime-slide-surface--${weeklySlide}` : ''}`}>
                  <div
                    className={`uptime-week-calendar ${isMobile ? 'uptime-week-calendar--single-day' : ''} ${
                      weeklySlide ? `uptime-week-calendar--expand-${weeklySlide}` : ''
                    }`}
                  >
                    <div className="uptime-week-calendar__head">
                      <div className="uptime-week-calendar__axis-spacer" />
                      {visibleTimelineDays.map((day) => (
                        <div key={`head-${day.date}`} className="uptime-week-calendar__day-head">
                          <p>{formatWeekDayLabel(day.date)}</p>
                          <span>{formatSecondsToHours(day.online_seconds)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="uptime-week-calendar__body">
                      <div className="uptime-week-calendar__axis">
                        {HOUR_MARKERS.map((hour) => (
                          <span
                            key={`axis-${hour}`}
                            className={`uptime-week-calendar__axis-label ${
                              hour === 0
                                ? 'uptime-week-calendar__axis-label--start'
                                : hour === 24
                                  ? 'uptime-week-calendar__axis-label--end'
                                  : 'uptime-week-calendar__axis-label--hourly'
                            }`.trim()}
                            style={{ top: `${(hour / 24) * 100}%` }}
                          >
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>

                      <div className="uptime-week-calendar__columns">
                        {visibleTimelineDays.map((day) => (
                          <div key={day.date} className="uptime-week-calendar__column">
                            {Array.from({ length: 23 }).map((_, index) => (
                              <span
                                key={`${day.date}-${index}`}
                                className="uptime-week-calendar__hour-line"
                                style={{ top: `${((index + 1) / 24) * 100}%` }}
                              />
                            ))}
                            {day.intervals.map((interval, index) => {
                              const position = intervalToVertical(interval)
                              const mode = getIntervalDisplayMode(interval.duration_seconds)
                              return (
                                <span
                                  key={`${day.date}-${interval.start}-${interval.end}-${index}`}
                                  className={`uptime-week-calendar__event uptime-week-calendar__event--${mode}`}
                                  style={{
                                    top: `${position.top}%`,
                                    height: `${position.height}%`,
                                  }}
                                  title={`${day.date} ${interval.start} - ${interval.end} (${formatSecondsToHours(interval.duration_seconds)})`}
                                >
                                  {mode === 'full' ? (
                                    <>
                                      <span className="uptime-week-calendar__event-start">{interval.start}</span>
                                      <span className="uptime-week-calendar__event-end">{interval.end}</span>
                                    </>
                                  ) : null}
                                  {mode === 'compact' ? (
                                    <span className="uptime-week-calendar__event-range">
                                      {interval.start} - {interval.end}
                                    </span>
                                  ) : null}
                                </span>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {weeklyLoading ? (
                  <div className="uptime-loading-overlay">
                    <LoadingDots label="稼働タイムラインを読み込み中です" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      )}
    </>
  )

  if (embedded) {
    return <div className="panel-embedded panel-embedded--uptime">{content}</div>
  }

  return <section className="panel">{content}</section>
}

export default UptimePanel
