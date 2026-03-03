import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  type TouchEvent,
} from 'react'

import type { SlideDirection, SummaryBucket, TimelineDay } from './types'
import {
  addDays,
  moveSummaryAnchor,
  parseIsoDateLocal,
  startOfWeekSunday,
  toIsoDateLocal,
} from './utils'
import { useSwipeNavigation } from './useSwipeNavigation'

interface UseUptimeNavigationInput {
  isMobile: boolean
  summaryBucket: SummaryBucket
  weekStart: string
  weekStartDate: Date
  todayIsoDate: string
  isSummaryNextDisabled: boolean
  activePcId: string
  activeTimelineDay: TimelineDay | null
  timelineDays: TimelineDay[]
  mobileCursorDate: string
  pendingSummarySlideRef: MutableRefObject<SlideDirection>
  pendingWeeklySlideRef: MutableRefObject<SlideDirection>
  pendingMobileCursorRef: MutableRefObject<string | null>
  setSummaryBucket: Dispatch<SetStateAction<SummaryBucket>>
  setSummaryAnchor: Dispatch<SetStateAction<Date>>
  setReferenceDate: Dispatch<SetStateAction<string>>
  setWeekStart: Dispatch<SetStateAction<string>>
  setWeeklySlide: Dispatch<SetStateAction<SlideDirection>>
  setMobileCursorDate: Dispatch<SetStateAction<string>>
}

interface UseUptimeNavigationResult {
  changeSummaryBucket: (next: SummaryBucket) => void
  changeReferenceDate: (nextIsoDate: string) => void
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

export function useUptimeNavigation({
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
}: UseUptimeNavigationInput): UseUptimeNavigationResult {
  useEffect(() => {
    if (!isMobile) {
      pendingMobileCursorRef.current = null
      return
    }
    if (timelineDays.length === 0) {
      return
    }

    const pendingCursor = pendingMobileCursorRef.current
    if (pendingCursor) {
      if (timelineDays.some((day) => day.date === pendingCursor)) {
        if (mobileCursorDate !== pendingCursor) {
          setMobileCursorDate(pendingCursor)
        }
        pendingMobileCursorRef.current = null
      }
      return
    }

    if (timelineDays.some((day) => day.date === mobileCursorDate)) {
      return
    }
    if (mobileCursorDate <= timelineDays[0].date) {
      setMobileCursorDate(timelineDays[0].date)
      return
    }
    setMobileCursorDate(timelineDays[timelineDays.length - 1].date)
  }, [isMobile, mobileCursorDate, pendingMobileCursorRef, setMobileCursorDate, timelineDays])

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

    const activeDate = activeTimelineDay?.date || mobileCursorDate
    const activeDateObj = parseIsoDateLocal(activeDate)
    if (!activeDateObj) {
      return
    }

    const nextDateObj = addDays(activeDateObj, direction)
    const nextDate = toIsoDateLocal(nextDateObj)
    if (direction > 0 && nextDate > todayIsoDate) {
      return
    }

    setWeeklySlide(direction < 0 ? 'prev' : 'next')
    setMobileCursorDate(nextDate)
    const nextWeekStart = toIsoDateLocal(startOfWeekSunday(nextDateObj))
    if (nextWeekStart !== weekStart) {
      pendingMobileCursorRef.current = nextDate
      pendingWeeklySlideRef.current = direction < 0 ? 'prev' : 'next'
      setWeekStart(nextWeekStart)
    }
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

  const changeReferenceDate = (nextIsoDate: string): void => {
    const parsed = parseIsoDateLocal(nextIsoDate)
    if (!parsed) {
      return
    }

    const today = parseIsoDateLocal(toIsoDateLocal(new Date())) || new Date()
    const normalized = parsed > today ? today : parsed
    const normalizedIso = toIsoDateLocal(normalized)
    pendingSummarySlideRef.current = 'next'
    pendingWeeklySlideRef.current = 'next'
    pendingMobileCursorRef.current = normalizedIso
    setReferenceDate(normalizedIso)
    setSummaryAnchor(normalized)
    setWeekStart(toIsoDateLocal(startOfWeekSunday(normalized)))
    setMobileCursorDate(normalizedIso)
  }

  const summarySwipe = useSwipeNavigation({
    enabled: isMobile,
    onSwipePrev: () => {
      moveSummary(-1)
    },
    onSwipeNext: () => {
      if (!isSummaryNextDisabled) {
        moveSummary(1)
      }
    },
  })

  const timelineSwipe = useSwipeNavigation({
    enabled: isMobile,
    onSwipePrev: () => {
      moveTimeline(-1)
    },
    onSwipeNext: () => {
      moveTimeline(1)
    },
  })

  return {
    changeSummaryBucket,
    changeReferenceDate,
    moveSummary,
    moveTimeline,
    handlePcSelectionChange,
    handleSummaryTouchStart: summarySwipe.onTouchStart,
    handleSummaryTouchEnd: summarySwipe.onTouchEnd,
    handleSummaryTouchCancel: summarySwipe.onTouchCancel,
    handleTimelineTouchStart: timelineSwipe.onTouchStart,
    handleTimelineTouchEnd: timelineSwipe.onTouchEnd,
    handleTimelineTouchCancel: timelineSwipe.onTouchCancel,
  }
}
