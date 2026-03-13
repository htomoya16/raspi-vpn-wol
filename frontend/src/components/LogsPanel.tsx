import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

import { useDelayedVisibility } from '../hooks/useDelayedVisibility'
import { useMediaQuery } from '../hooks/useMediaQuery'
import LoadingDots from './LoadingDots'
import LogsPanelContent from './log-panel/LogsPanelContent'
import { buildLogGroups } from './log-panel/logGrouping'
import { useLogsPanelState } from './log-panel/useLogsPanelState'
import { useStickyGroupHeaders } from './log-panel/useStickyGroupHeaders'
import type { LogEntry } from '../types/models'

export interface LogsPanelProps {
  items: LogEntry[]
  loading: boolean
  loadingMore?: boolean
  hasMore?: boolean
  error: string
  onReload: () => Promise<void> | void
  onLoadMore?: () => Promise<void> | void
  onClear: () => Promise<void>
  embedded?: boolean
}

function LogsPanel({
  items,
  loading,
  loadingMore = false,
  hasMore = false,
  error,
  onReload,
  onLoadMore,
  onClear,
  embedded = false,
}: LogsPanelProps) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const panelId = useMemo(() => `logs-panel-${Math.random().toString(36).slice(2, 10)}`, [])
  const focusPanelId = `${panelId}-focus`
  const mainSheetRef = useRef<HTMLDivElement | null>(null)
  const focusSheetRef = useRef<HTMLDivElement | null>(null)
  const mainLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const loadMoreInFlightRef = useRef(false)
  const touchLastYRef = useRef<number | null>(null)
  const touchPullDistanceRef = useRef(0)
  const touchGestureConsumedRef = useRef(false)

  const {
    confirmOpen,
    focusOpen,
    clearLoading,
    expandedDetailIds,
    collapsedGroupKeys,
    openConfirm,
    closeConfirm,
    openFocus,
    closeFocus,
    setClearLoading,
    toggleDetail,
    toggleGroup,
    syncGroupKeys,
  } = useLogsPanelState()

  const hasItems = items.length > 0
  const logGroups = useMemo(() => buildLogGroups(items), [items])
  const showInitialLoading = loading && !hasItems
  const showRefreshingSpinner = useDelayedVisibility(loading && hasItems, 200)
  const autoLoadOnScroll = isMobile && Boolean(onLoadMore)
  const stickySyncToken = useMemo(() => {
    const groupKeys = logGroups.map((group) => group.key).join(',')
    const collapsedKeys = Array.from(collapsedGroupKeys).sort().join(',')
    return `${focusOpen ? 'focus-open' : 'focus-close'}|${groupKeys}|${collapsedKeys}`
  }, [collapsedGroupKeys, focusOpen, logGroups])

  useEffect(() => {
    syncGroupKeys(new Set(logGroups.map((group) => group.key)))
  }, [logGroups, syncGroupKeys])

  useStickyGroupHeaders({
    mainSheetRef,
    focusSheetRef,
    syncToken: stickySyncToken,
  })

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }
    if (!focusOpen) {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [focusOpen])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }
    if (!confirmOpen) {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [confirmOpen])

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadMoreInFlightRef.current || loading || loadingMore || clearLoading || !hasMore) {
      return
    }
    loadMoreInFlightRef.current = true
    try {
      await Promise.resolve(onLoadMore())
    } finally {
      loadMoreInFlightRef.current = false
    }
  }, [clearLoading, hasMore, loading, loadingMore, onLoadMore])

  useEffect(() => {
    if (!autoLoadOnScroll || !hasMore || !onLoadMore) {
      return undefined
    }

    const getDistanceFromBottom = () => {
      if (typeof document === 'undefined') {
        return Number.POSITIVE_INFINITY
      }
      const doc = document.documentElement
      const viewportBottom = window.scrollY + window.innerHeight
      return doc.scrollHeight - viewportBottom
    }

    const isNearBottom = () => getDistanceFromBottom() <= 4

    const resetTouchTracking = () => {
      touchLastYRef.current = null
      touchPullDistanceRef.current = 0
      touchGestureConsumedRef.current = false
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }
      touchLastYRef.current = touch.clientY
      touchPullDistanceRef.current = 0
      touchGestureConsumedRef.current = false
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (
        loadMoreInFlightRef.current ||
        loading ||
        loadingMore ||
        clearLoading ||
        touchGestureConsumedRef.current
      ) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const lastY = touchLastYRef.current
      touchLastYRef.current = touch.clientY
      if (lastY === null) {
        return
      }

      const delta = touch.clientY - lastY
      if (delta < 0) {
        touchPullDistanceRef.current += -delta
      } else {
        touchPullDistanceRef.current = 0
      }

      if (!isNearBottom() || touchPullDistanceRef.current < 28) {
        return
      }

      touchGestureConsumedRef.current = true
      touchPullDistanceRef.current = 0
      void handleLoadMore()
    }

    const handleTouchEnd = () => {
      resetTouchTracking()
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [autoLoadOnScroll, clearLoading, handleLoadMore, hasMore, loading, loadingMore, onLoadMore])

  useEffect(() => {
    if (!focusOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || clearLoading) {
        return
      }
      closeFocus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [clearLoading, closeFocus, focusOpen])

  async function confirmClear() {
    if (clearLoading) {
      return
    }
    setClearLoading(true)
    try {
      await onClear()
      closeConfirm()
    } catch {
      // noop: エラー表示は親コンポーネント経由で描画される
    } finally {
      setClearLoading(false)
    }
  }

  function handleCloseConfirm() {
    if (clearLoading) {
      return
    }
    closeConfirm()
  }

  function handleCloseFocus() {
    if (clearLoading) {
      return
    }
    closeFocus()
  }

  const content = (
    <LogsPanelContent
      titleId={panelId}
      items={items}
      loading={loading}
      error={error}
      clearLoading={clearLoading}
      showInitialLoading={showInitialLoading}
      showRefreshingSpinner={showRefreshingSpinner}
      showFocusButton
      showClearButton
      logGroups={logGroups}
      collapsedGroupKeys={collapsedGroupKeys}
      expandedDetailIds={expandedDetailIds}
      sheetRef={mainSheetRef}
      onReload={onReload}
      onOpenFocus={openFocus}
      onOpenConfirm={openConfirm}
      onToggleGroup={toggleGroup}
      onToggleDetail={toggleDetail}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={handleLoadMore}
      autoLoadOnScroll={autoLoadOnScroll}
      loadMoreSentinelRef={mainLoadMoreSentinelRef}
    />
  )

  return (
    <>
      {embedded ? <div className="panel-embedded panel-embedded--logs">{content}</div> : <section className="panel">{content}</section>}

      {focusOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="logs-focus__backdrop" role="presentation" onClick={handleCloseFocus}>
              <section
                className="panel logs-focus__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={focusPanelId}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="logs-focus__header">
                  <p className="logs-focus__title">ログ前面表示</p>
                  <button
                    type="button"
                    className="logs-focus__close-btn"
                    aria-label="前面表示を閉じる"
                    onClick={handleCloseFocus}
                  >
                    ✕
                  </button>
                </div>
                <LogsPanelContent
                  titleId={focusPanelId}
                  items={items}
                  loading={loading}
                  error={error}
                  clearLoading={clearLoading}
                  showInitialLoading={showInitialLoading}
                  showRefreshingSpinner={showRefreshingSpinner}
                  showFocusButton={false}
                  showClearButton={false}
                  logGroups={logGroups}
                  collapsedGroupKeys={collapsedGroupKeys}
                  expandedDetailIds={expandedDetailIds}
                  sheetRef={focusSheetRef}
                  onReload={onReload}
                  onOpenFocus={openFocus}
                  onOpenConfirm={openConfirm}
                  onToggleGroup={toggleGroup}
                  onToggleDetail={toggleDetail}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  onLoadMore={handleLoadMore}
                  autoLoadOnScroll={false}
                />
              </section>
            </div>,
            document.body,
          )
        : null}

      {confirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="confirm-dialog__backdrop" role="presentation" onClick={handleCloseConfirm}>
              <div
                className="confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="log-clear-dialog-title"
                aria-describedby="log-clear-dialog-description"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 id="log-clear-dialog-title">ログを消去しますか？</h3>
                <p id="log-clear-dialog-description">
                  現在表示されている操作ログを全件削除します。この操作は取り消せません。
                </p>
                <div className="confirm-dialog__actions">
                  <button type="button" className="btn btn--soft" onClick={handleCloseConfirm} disabled={clearLoading}>
                    キャンセル
                  </button>
                  <button type="button" className="btn btn--danger" onClick={confirmClear} disabled={clearLoading}>
                    {clearLoading ? <LoadingDots label="消去中" /> : '消去する'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export default LogsPanel
