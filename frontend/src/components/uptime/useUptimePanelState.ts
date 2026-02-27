import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'

import { formatApiError } from '../../api/http'
import { getPcUptimeSummary, getPcWeeklyTimeline } from '../../api/pcs'
import { buildMockUptimeSummary, buildMockWeeklyTimeline } from '../../mocks/uptime'
import type {
  Pc,
  PcUptimeSummaryResponse,
  PcWeeklyTimelineResponse,
  UptimeBucket,
  UptimeSummaryItem,
} from '../../types/models'
import type { SlideDirection, SummaryAxisTick, SummaryBucket, TimelineDay } from './types'
import {
  HOUR_MARKERS,
  addDays,
  buildSummaryAxisTicks,
  buildTimelineDays,
  buildWeeklyFallback,
  canMoveSummaryNext,
  clamp,
  formatDateRange,
  getCurrentWeekStart,
  getSummaryQuery,
  moveSummaryAnchor,
  parseIsoDateLocal,
  startOfWeekSunday,
  toBucketedMaxSeconds,
  toIsoDateLocal,
} from './utils'

const DEFAULT_TZ = 'Asia/Tokyo'
const ENABLE_UPTIME_MOCK = Boolean(import.meta.env.DEV)
const SWIPE_THRESHOLD_PX = 44
const SWIPE_MAX_VERTICAL_PX = 60

interface UseUptimePanelStateInput {
  pcs: Pc[]
  selectedPcId: string
  dataVersion?: string
  isMobile: boolean
}

export interface UptimePanelState {
  enableUptimeMock: boolean
  useMockData: boolean
  activePcId: string
  summaryBucket: SummaryBucket
  summaryQuery: { from: string; to: string; apiBucket: UptimeBucket }
  summaryDateRangeLabel: string
  summaryItems: UptimeSummaryItem[]
  summaryLoading: boolean
  summaryError: string
  summarySlide: SlideDirection
  summaryMaxSeconds: number
  summaryAverageSeconds: number
  summaryAveragePercent: number
  summaryAxisTicks: SummaryAxisTick[]
  summaryGridStyle: CSSProperties
  isSummaryNextDisabled: boolean
  weekStart: string
  weeklyData: PcWeeklyTimelineResponse
  visibleTimelineDays: TimelineDay[]
  activeTimelineDay: TimelineDay | null
  weeklyLoading: boolean
  weeklyError: string
  weeklySlide: SlideDirection
  isTimelineNextDisabled: boolean
  isMobile: boolean
  hourMarkers: number[]
  changeSummaryBucket: (next: SummaryBucket) => void
  handleToggleMockData: () => void
  moveSummary: (direction: 1 | -1) => void
  moveTimeline: (direction: 1 | -1) => void
  handlePcSelectionChange: (nextPcId: string, onSelectPc: (pcId: string) => void) => void
  handleSummaryTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  handleSummaryTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  handleSummaryTouchCancel: () => void
  handleTimelineTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  handleTimelineTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  handleTimelineTouchCancel: () => void
}

export function useUptimePanelState({
  pcs,
  selectedPcId,
  dataVersion = '',
  isMobile,
}: UseUptimePanelStateInput): UptimePanelState {
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
    if (!ENABLE_UPTIME_MOCK || typeof window === 'undefined') {
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

  const summaryDateRangeLabel = useMemo(
    () => formatDateRange(summaryQuery.from, summaryQuery.to),
    [summaryQuery.from, summaryQuery.to],
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

  const flushSummarySlideIfNeeded = (): void => {
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

  const flushWeeklySlideIfNeeded = (): void => {
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

  const weeklyData = useMemo(
    () => weekly || buildWeeklyFallback(weekStart, DEFAULT_TZ),
    [weekStart, weekly],
  )
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

  const moveSummary = (direction: 1 | -1): void => {
    pendingSummarySlideRef.current = direction < 0 ? 'prev' : 'next'
    setSummaryAnchor((prev) => moveSummaryAnchor(prev, summaryBucket, direction))
  }

  const moveWeekly = (offset: number): void => {
    pendingWeeklySlideRef.current = offset < 0 ? 'prev' : 'next'
    const base = parseIsoDateLocal(weekStart) || weekStartDate
    setWeekStart(toIsoDateLocal(addDays(base, offset * 7)))
  }

  const moveTimeline = (direction: 1 | -1): void => {
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

  const handleToggleMockData = (): void => {
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

  const handlePcSelectionChange = (nextPcId: string, onSelectPc: (pcId: string) => void): void => {
    if (nextPcId !== activePcId) {
      pendingSummarySlideRef.current = 'next'
      pendingWeeklySlideRef.current = 'next'
    }
    onSelectPc(nextPcId)
  }

  const changeSummaryBucket = (next: SummaryBucket): void => {
    pendingSummarySlideRef.current = 'next'
    setSummaryBucket(next)
    setSummaryAnchor(new Date())
  }

  const handleSummaryTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    if (!isMobile) {
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    summaryTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleSummaryTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
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

  const handleTimelineTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    if (!isMobile) {
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    timelineTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTimelineTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
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

  return {
    enableUptimeMock: ENABLE_UPTIME_MOCK,
    useMockData,
    activePcId,
    summaryBucket,
    summaryQuery,
    summaryDateRangeLabel,
    summaryItems,
    summaryLoading,
    summaryError,
    summarySlide,
    summaryMaxSeconds,
    summaryAverageSeconds,
    summaryAveragePercent,
    summaryAxisTicks,
    summaryGridStyle,
    isSummaryNextDisabled,
    weekStart,
    weeklyData,
    visibleTimelineDays,
    activeTimelineDay,
    weeklyLoading,
    weeklyError,
    weeklySlide,
    isTimelineNextDisabled,
    isMobile,
    hourMarkers: HOUR_MARKERS,
    changeSummaryBucket,
    handleToggleMockData,
    moveSummary,
    moveTimeline,
    handlePcSelectionChange,
    handleSummaryTouchStart,
    handleSummaryTouchEnd,
    handleSummaryTouchCancel: () => {
      summaryTouchStartRef.current = null
    },
    handleTimelineTouchStart,
    handleTimelineTouchEnd,
    handleTimelineTouchCancel: () => {
      timelineTouchStartRef.current = null
    },
  }
}
