import { useRef, type TouchEvent } from 'react'

const SWIPE_THRESHOLD_PX = 44
const SWIPE_MAX_VERTICAL_PX = 60

interface UseSwipeNavigationInput {
  enabled: boolean
  onSwipePrev: () => void
  onSwipeNext: () => void
}

interface UseSwipeNavigationResult {
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  onTouchCancel: () => void
}

export function useSwipeNavigation({
  enabled,
  onSwipePrev,
  onSwipeNext,
}: UseSwipeNavigationInput): UseSwipeNavigationResult {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    if (!enabled) {
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!enabled || !start) {
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
      onSwipePrev()
      return
    }
    onSwipeNext()
  }

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel: () => {
      touchStartRef.current = null
    },
  }
}
