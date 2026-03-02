import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'

import type { Pc, PcWeeklyTimelineResponse, UptimeBucket, UptimeSummaryItem } from '../../types/models'
import type { SlideDirection, SummaryAxisTick, SummaryBucket, TimelineDay } from './types'
import {
  HOUR_MARKERS,
  canMoveSummaryNext,
  formatDateRange,
  getCurrentWeekStart,
  getSummaryQuery,
  parseIsoDateLocal,
  startOfWeekSunday,
  toIsoDateLocal,
} from './utils'
import { useUptimeDerivedMetrics } from './useUptimeDerivedMetrics'
import { useUptimeNavigation } from './useUptimeNavigation'
import { useUptimeSummaryData } from './useUptimeSummaryData'
import { useUptimeTimelineData } from './useUptimeTimelineData'

const DEFAULT_TZ = 'Asia/Tokyo'
const ENABLE_UPTIME_MOCK = Boolean(import.meta.env.DEV)

interface UseUptimePanelStateInput {
  pcs: Pc[]
  selectedPcId: string
  dataVersion?: string
  isMobile: boolean
  enabled: boolean
}

export interface UptimePanelState {
  enableUptimeMock: boolean
  useMockData: boolean
  activePcId: string
  referenceDate: string
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
  changeReferenceDate: (nextIsoDate: string) => void
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
  enabled,
}: UseUptimePanelStateInput): UptimePanelState {
  const [summaryBucket, setSummaryBucket] = useState<SummaryBucket>('day')
  const [summaryAnchor, setSummaryAnchor] = useState<Date>(() => new Date())
  const [referenceDate, setReferenceDate] = useState(() => toIsoDateLocal(new Date()))
  const [summarySlide, setSummarySlide] = useState<SlideDirection>(null)
  const pendingSummarySlideRef = useRef<SlideDirection>(null)

  const [weekStart, setWeekStart] = useState(getCurrentWeekStart)
  const [weeklySlide, setWeeklySlide] = useState<SlideDirection>(null)
  const pendingWeeklySlideRef = useRef<SlideDirection>(null)

  const [mobileCursorDate, setMobileCursorDate] = useState(() => toIsoDateLocal(new Date()))
  const pendingMobileCursorRef = useRef<string | null>(null)

  const [useMockData, setUseMockData] = useState<boolean>(() => {
    if (!ENABLE_UPTIME_MOCK || typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('uptime:mock') === '1'
  })

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
  const todayIsoDate = toIsoDateLocal(new Date())

  const summaryQuery = useMemo(
    () => getSummaryQuery(summaryAnchor, summaryBucket, isMobile && summaryBucket === 'month' ? 6 : 12),
    [isMobile, summaryAnchor, summaryBucket],
  )

  const summaryDateRangeLabel = useMemo(
    () => formatDateRange(summaryQuery.from, summaryQuery.to),
    [summaryQuery.from, summaryQuery.to],
  )

  const isSummaryNextDisabled = useMemo(
    () => !canMoveSummaryNext(summaryAnchor, summaryBucket),
    [summaryAnchor, summaryBucket],
  )

  const flushSummarySlideIfNeeded = useCallback((): void => {
    const pending = pendingSummarySlideRef.current
    if (!pending || typeof window === 'undefined') {
      return
    }
    pendingSummarySlideRef.current = null
    setSummarySlide(null)
    window.requestAnimationFrame(() => {
      setSummarySlide(pending)
    })
  }, [])

  const flushWeeklySlideIfNeeded = useCallback((): void => {
    const pending = pendingWeeklySlideRef.current
    if (!pending || typeof window === 'undefined') {
      return
    }
    pendingWeeklySlideRef.current = null
    setWeeklySlide(null)
    window.requestAnimationFrame(() => {
      setWeeklySlide(pending)
    })
  }, [])

  useEffect(() => {
    if (!activePcId) {
      previousActivePcIdRef.current = ''
      return
    }
    const previousPcId = previousActivePcIdRef.current
    if (previousPcId && previousPcId !== activePcId) {
      const today = new Date()
      const todayIso = toIsoDateLocal(today)
      pendingSummarySlideRef.current = 'next'
      pendingWeeklySlideRef.current = 'next'
      pendingMobileCursorRef.current = todayIso
      const nextWeekStart = toIsoDateLocal(startOfWeekSunday(today))
      const applyPcSwitchDefaults = () => {
        setSummaryBucket('day')
        setSummaryAnchor(today)
        setReferenceDate(todayIso)
        setWeekStart(nextWeekStart)
        setMobileCursorDate(todayIso)
      }
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(applyPcSwitchDefaults)
      } else {
        setTimeout(applyPcSwitchDefaults, 0)
      }
    }
    previousActivePcIdRef.current = activePcId
  }, [activePcId])

  useEffect(() => {
    if (enabled) {
      return
    }
    pendingSummarySlideRef.current = null
    pendingWeeklySlideRef.current = null
    pendingMobileCursorRef.current = null
  }, [enabled])

  const handleSummaryFetchError = useCallback(() => {
    pendingSummarySlideRef.current = null
  }, [])

  const handleTimelineFetchError = useCallback(() => {
    pendingWeeklySlideRef.current = null
  }, [])

  const { summary, summaryLoading, summaryError } = useUptimeSummaryData({
    enabled,
    activePcId,
    dataVersion,
    from: summaryQuery.from,
    to: summaryQuery.to,
    apiBucket: summaryQuery.apiBucket,
    tz: DEFAULT_TZ,
    useMockData,
    enableMock: ENABLE_UPTIME_MOCK,
    onSettled: flushSummarySlideIfNeeded,
    onError: handleSummaryFetchError,
  })

  const { weekly, weeklyLoading, weeklyError } = useUptimeTimelineData({
    enabled,
    activePcId,
    dataVersion,
    weekStart,
    tz: DEFAULT_TZ,
    useMockData,
    enableMock: ENABLE_UPTIME_MOCK,
    onSettled: flushWeeklySlideIfNeeded,
    onError: handleTimelineFetchError,
  })

  const {
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
    isTimelineNextDisabled,
  } = useUptimeDerivedMetrics({
    summary,
    weekly,
    weekStart,
    summaryBucket,
    isMobile,
    mobileCursorDate,
    todayIsoDate,
    weekStartDate,
    currentWeekStartDate,
    tz: DEFAULT_TZ,
  })

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

  const {
    changeSummaryBucket,
    changeReferenceDate,
    moveSummary,
    moveTimeline,
    handlePcSelectionChange,
    handleSummaryTouchStart,
    handleSummaryTouchEnd,
    handleSummaryTouchCancel,
    handleTimelineTouchStart,
    handleTimelineTouchEnd,
    handleTimelineTouchCancel,
  } = useUptimeNavigation({
    isMobile,
    summaryBucket,
    weekStart,
    weekStartDate,
    todayIsoDate,
    isSummaryNextDisabled,
    activePcId,
    activeTimelineDay,
    timelineDays,
    mobileCursorDate,
    pendingSummarySlideRef,
    pendingWeeklySlideRef,
    pendingMobileCursorRef,
    setSummaryBucket,
    setSummaryAnchor,
    setReferenceDate,
    setWeekStart,
    setWeeklySlide,
    setMobileCursorDate,
  })

  return {
    enableUptimeMock: ENABLE_UPTIME_MOCK,
    useMockData,
    activePcId,
    referenceDate,
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
    changeReferenceDate,
    handleToggleMockData,
    moveSummary,
    moveTimeline,
    handlePcSelectionChange,
    handleSummaryTouchStart,
    handleSummaryTouchEnd,
    handleSummaryTouchCancel,
    handleTimelineTouchStart,
    handleTimelineTouchEnd,
    handleTimelineTouchCancel,
  }
}
