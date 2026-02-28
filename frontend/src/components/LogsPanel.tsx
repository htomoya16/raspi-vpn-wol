import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useDelayedVisibility } from '../hooks/useDelayedVisibility'
import LoadingDots from './LoadingDots'
import LoadingSpinner from './LoadingSpinner'
import type { LogEntry } from '../types/models'
import { formatJstDateParts } from '../utils/datetime'

function formatDetails(details: LogEntry['details']): string {
  if (details === null || details === undefined || details === '') {
    return '-'
  }
  if (typeof details === 'string') {
    const trimmed = details.trim()
    if (trimmed === '') {
      return '-'
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // noop: 文字列のまま表示する
    }
    return details.replace(/\r\n/g, '\n')
  }
  if (typeof details === 'object') {
    return JSON.stringify(details, null, 2)
  }
  return String(details)
}

type LogGroup = {
  key: string
  kind: 'job' | 'normal'
  title: string
  subtitle: string | null
  jobName: string | null
  okCount: number
  ngCount: number
  latestLogId: number
  items: LogEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  wol: 'WOL送信',
  status: 'ステータス確認',
  pc_upsert: 'PC登録/更新',
  pc_delete: 'PC削除',
  seed_wol: 'WOL送信',
  seed_status: '定期ステータス確認',
}
const PERIODIC_STATUS_GROUP_KEY = 'job:periodic-status'

function extractJobId(item: LogEntry): string | null {
  if (typeof item.job_id === 'string') {
    const normalized = item.job_id.trim()
    if (normalized) {
      return normalized
    }
  }
  return null
}

function getActionLabel(item: LogEntry): string {
  if ((item.action === 'status' || item.action === 'seed_status') && extractJobId(item)) {
    return '定期ステータス確認'
  }
  return ACTION_LABELS[item.action] || item.action
}

function isPeriodicStatusJobLog(item: LogEntry): boolean {
  return Boolean(extractJobId(item)) && (item.action === 'status' || item.action === 'seed_status')
}

function inferJobName(items: LogEntry[]): string | null {
  const actions = items.map((item) => item.action).filter(Boolean)
  if (actions.length === 0) {
    return null
  }
  const hasWol = actions.some((action) => action === 'wol' || action === 'seed_wol')
  if (hasWol) {
    return 'WOL送信'
  }
  const hasStatus = actions.some((action) => action === 'status' || action === 'seed_status')
  if (hasStatus) {
    return '定期ステータス確認'
  }

  const uniqueActions = Array.from(new Set(actions))
  if (uniqueActions.length === 1) {
    return ACTION_LABELS[uniqueActions[0]] || uniqueActions[0]
  }

  return '複合処理'
}

function buildLogGroups(items: LogEntry[]): LogGroup[] {
  const sortedItems = [...items].sort((a, b) => b.id - a.id)
  const groups: LogGroup[] = []
  const jobGroupMap = new Map<string, LogGroup>()
  const periodicStatusGroupJobIds = new Set<string>()
  let currentNormalGroup: LogGroup | null = null

  for (const item of sortedItems) {
    const jobId = extractJobId(item)
    const okCount = item.ok ? 1 : 0
    const ngCount = item.ok ? 0 : 1

    if (jobId) {
      currentNormalGroup = null
      const isPeriodicStatus = isPeriodicStatusJobLog(item)
      const key = isPeriodicStatus ? PERIODIC_STATUS_GROUP_KEY : `job:${jobId}`
      const existing = jobGroupMap.get(key)
      if (existing) {
        existing.items.push(item)
        existing.okCount += okCount
        existing.ngCount += ngCount
        existing.latestLogId = Math.max(existing.latestLogId, item.id)
        existing.jobName = inferJobName(existing.items)
        existing.title = existing.jobName || 'ジョブログ'
        if (isPeriodicStatus) {
          periodicStatusGroupJobIds.add(jobId)
          existing.subtitle = `定期ジョブ ${periodicStatusGroupJobIds.size}件`
        }
        continue
      }

      if (isPeriodicStatus) {
        periodicStatusGroupJobIds.add(jobId)
      }
      const nextGroup: LogGroup = {
        key,
        kind: 'job',
        title: isPeriodicStatus ? '定期ステータス確認' : inferJobName([item]) || 'ジョブログ',
        subtitle: isPeriodicStatus ? `定期ジョブ ${periodicStatusGroupJobIds.size}件` : `ID: ${jobId}`,
        jobName: inferJobName([item]),
        okCount,
        ngCount,
        latestLogId: item.id,
        items: [item],
      }
      jobGroupMap.set(key, nextGroup)
      groups.push(nextGroup)
      continue
    }

    if (!currentNormalGroup) {
      currentNormalGroup = {
        key: `normal:${item.id}`,
        kind: 'normal',
        title: '通常ログ',
        subtitle: null,
        jobName: null,
        okCount: 0,
        ngCount: 0,
        latestLogId: item.id,
        items: [],
      }
      groups.push(currentNormalGroup)
    }
    currentNormalGroup.items.push(item)
    currentNormalGroup.okCount += okCount
    currentNormalGroup.ngCount += ngCount
    currentNormalGroup.latestLogId = Math.max(currentNormalGroup.latestLogId, item.id)
  }

  return groups.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => b.id - a.id),
  }))
}

export interface LogsPanelProps {
  items: LogEntry[]
  loading: boolean
  error: string
  onReload: () => Promise<void> | void
  onClear: () => Promise<void>
  embedded?: boolean
}

function LogsPanel({
  items,
  loading,
  error,
  onReload,
  onClear,
  embedded = false,
}: LogsPanelProps) {
  const panelId = useMemo(
    () => `logs-panel-${Math.random().toString(36).slice(2, 10)}`,
    [],
  )
  const focusPanelId = `${panelId}-focus`
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<number>>(() => new Set())
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(
    () => new Set([PERIODIC_STATUS_GROUP_KEY]),
  )
  const mainSheetRef = useRef<HTMLDivElement | null>(null)
  const focusSheetRef = useRef<HTMLDivElement | null>(null)
  const hasItems = items.length > 0
  const logGroups = useMemo(() => buildLogGroups(items), [items])
  const showInitialLoading = loading && !hasItems
  const showRefreshingSpinner = useDelayedVisibility(loading && hasItems, 200)

  useEffect(() => {
    const activeKeys = new Set(logGroups.map((group) => group.key))
    setCollapsedGroupKeys((prev) => {
      const next = new Set<string>()
      for (const key of prev) {
        if (activeKeys.has(key)) {
          next.add(key)
        }
      }
      if (activeKeys.has(PERIODIC_STATUS_GROUP_KEY)) {
        next.add(PERIODIC_STATUS_GROUP_KEY)
      }
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [logGroups])

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

  useEffect(() => {
    if (!focusOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      setFocusOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const sheets = [mainSheetRef.current, focusSheetRef.current].filter(
      (sheet): sheet is HTMLDivElement => Boolean(sheet),
    )
    if (sheets.length === 0) {
      return undefined
    }

    const syncStickyGroup = (sheet: HTMLDivElement) => {
      const rows = Array.from(sheet.querySelectorAll<HTMLTableRowElement>('.logs-table__group-row'))
      rows.forEach((row) => row.classList.remove('logs-table__group-row--sticky'))
      if (rows.length === 0) {
        return
      }

      const sheetRect = sheet.getBoundingClientRect()
      const sheetStyle = window.getComputedStyle(sheet)
      const isWindowScrollContext =
        sheetStyle.overflowY === 'visible' || sheet.scrollHeight <= sheet.clientHeight + 1

      const thead = sheet.querySelector('thead')
      const theadHeight = thead ? thead.getBoundingClientRect().height : 0
      const stickyTop = isWindowScrollContext ? 0 : sheetRect.top + theadHeight

      let activeRow: HTMLTableRowElement | null = null
      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        if (rect.top <= stickyTop + 1) {
          activeRow = row
          continue
        }
        break
      }

      if (activeRow) {
        activeRow.classList.add('logs-table__group-row--sticky')
      }
    }

    let rafId = 0
    const syncAll = () => {
      if (rafId) {
        return
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        sheets.forEach((sheet) => syncStickyGroup(sheet))
      })
    }

    syncAll()
    sheets.forEach((sheet) => {
      sheet.addEventListener('scroll', syncAll, { passive: true })
    })
    window.addEventListener('scroll', syncAll, { passive: true })
    window.addEventListener('resize', syncAll)

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      sheets.forEach((sheet) => {
        sheet.removeEventListener('scroll', syncAll)
      })
      window.removeEventListener('scroll', syncAll)
      window.removeEventListener('resize', syncAll)
    }
  }, [focusOpen, logGroups, collapsedGroupKeys])

  function openConfirm() {
    setConfirmOpen(true)
  }

  function closeConfirm() {
    if (clearLoading) {
      return
    }
    setConfirmOpen(false)
  }

  function openFocus() {
    setFocusOpen(true)
  }

  function closeFocus() {
    if (clearLoading) {
      return
    }
    setFocusOpen(false)
  }

  async function confirmClear() {
    if (clearLoading) {
      return
    }
    setClearLoading(true)
    try {
      await onClear()
      setConfirmOpen(false)
    } catch {
      // noop: エラー表示は親コンポーネント経由で描画される
    } finally {
      setClearLoading(false)
    }
  }

  function toggleDetails(id: number) {
    setExpandedDetailIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleGroup(key: string) {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function renderContent(
    titleId: string,
    showFocusButton: boolean,
    showClearButton: boolean,
    sheetRef: RefObject<HTMLDivElement | null>,
  ) {
    return (
    <>
      <div className="panel__header logs-panel__header">
        <div>
          <h2 id={titleId}>操作ログ</h2>
          <p>最新ログを1シートで確認できます。</p>
        </div>
      </div>

      <div className="logs-toolbar">
        <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading || clearLoading}>
          {showInitialLoading ? (
            <LoadingDots label="読み込み中" />
          ) : (
            <span className="btn__with-spinner">
              {showRefreshingSpinner ? <LoadingSpinner ariaLabel="ログを更新中です" /> : null}
              <span>再読込</span>
            </span>
          )}
        </button>
        {showClearButton ? (
          <button
            type="button"
            className="btn btn--danger"
            onClick={openConfirm}
            disabled={items.length === 0 || loading || clearLoading}
          >
            ログ消去
          </button>
        ) : null}
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="empty-state">ログがありません。</p>
      ) : (
        <div className="logs-sheet" ref={sheetRef}>
          <table className="logs-table">
            <thead>
              <tr>
                <th>時刻</th>
                <th>操作</th>
                <th>PC</th>
                <th>結果</th>
                <th>
                  <span className="logs-table__head-with-action">
                    <span>メッセージ</span>
                    {showFocusButton ? (
                      <button
                        type="button"
                        className="logs-table__icon-btn"
                        aria-label="ログを前面表示"
                        onClick={openFocus}
                      >
                        ⤢
                      </button>
                    ) : null}
                  </span>
                </th>
              </tr>
            </thead>
            {logGroups.map((group) => (
              <tbody key={group.key} className="logs-table__group-block">
                  <tr className="logs-table__group-row">
                    <td colSpan={5}>
                      <button
                        type="button"
                        className={`logs-table__group-toggle logs-table__group-toggle--${group.kind}`}
                        aria-expanded={!collapsedGroupKeys.has(group.key)}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <span className="logs-table__group-label">
                          <span className="logs-table__group-head">
                            <span
                              className={`logs-table__group-caret${collapsedGroupKeys.has(group.key) ? ' logs-table__group-caret--collapsed' : ''}`}
                              aria-hidden="true"
                            >
                              ▾
                            </span>
                            <span className="logs-table__group-title">
                              <span>{group.title}</span>
                              {group.subtitle ? <span className="logs-table__group-subtitle">{group.subtitle}</span> : null}
                            </span>
                          </span>
                          <span className="logs-table__group-counts">
                            <span className="logs-table__group-count logs-table__group-count--ok">OK {group.okCount}</span>
                            <span className="logs-table__group-count logs-table__group-count--ng">NG {group.ngCount}</span>
                            <span className="logs-table__group-count logs-table__group-count--total">{group.items.length}件</span>
                          </span>
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!collapsedGroupKeys.has(group.key)
                    ? group.items.map((item) => {
                        const detailsText = formatDetails(item.details)
                        const hasDetails = detailsText !== '-'
                        const isExpanded = hasDetails && expandedDetailIds.has(item.id)
                        const timeParts = formatJstDateParts(item.created_at, {
                          fallbackDate: '-',
                          fallbackTime: '',
                        })

                        return (
                          <Fragment key={item.id}>
                            <tr
                              className={`logs-table__row${hasDetails ? ' logs-table__row--expandable' : ''}${isExpanded ? ' logs-table__row--expanded' : ''}`}
                            >
                              <td data-label="時刻">
                                <span className="logs-time-cell">
                                  <span className="logs-time-cell__value">
                                    <span className="logs-time-cell__date">{timeParts.date}</span>
                                    {timeParts.time ? <span className="logs-time-cell__time">{timeParts.time}</span> : null}
                                  </span>
                                  <span
                                    className={`logs-result-badge logs-result-badge--mobile ${item.ok ? 'logs-result-badge--ok' : 'logs-result-badge--ng'}`}
                                    aria-label={item.ok ? '結果: OK' : '結果: NG'}
                                  >
                                    {item.ok ? 'OK' : 'NG'}
                                  </span>
                                </span>
                              </td>
                              <td data-label="操作">{getActionLabel(item)}</td>
                              <td data-label="PC">{item.pc_id || '-'}</td>
                              <td data-label="結果">
                                <span className={item.ok ? 'result-ok' : 'result-ng'}>{item.ok ? 'OK' : 'NG'}</span>
                              </td>
                              <td data-label="メッセージ">
                                <span className="logs-message-cell">
                                  <span className="logs-message-cell__text">{item.message || '-'}</span>
                                  {hasDetails ? (
                                    <button
                                      type="button"
                                      className={`logs-message-cell__hint${isExpanded ? ' logs-message-cell__hint--open' : ''}`}
                                      onClick={() => toggleDetails(item.id)}
                                      aria-expanded={isExpanded}
                                      aria-label={isExpanded ? '詳細を閉じる' : '詳細を表示'}
                                    >
                                      {isExpanded ? '閉じる' : '詳細'}
                                    </button>
                                  ) : null}
                                </span>
                              </td>
                            </tr>
                            {hasDetails && isExpanded ? (
                              <tr className="logs-table__detail-row">
                                <td colSpan={5}>
                                  <div className="log-details">
                                    <pre className="log-details__text log-details__text--expanded">{detailsText}</pre>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })
                    : null}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </>
  )
  }

  return (
    <>
      {embedded ? (
        <div className="panel-embedded panel-embedded--logs">{renderContent(panelId, true, true, mainSheetRef)}</div>
      ) : (
        <section className="panel">{renderContent(panelId, true, true, mainSheetRef)}</section>
      )}

      {focusOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="logs-focus__backdrop" role="presentation" onClick={closeFocus}>
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
                    onClick={closeFocus}
                  >
                    ✕
                  </button>
                </div>
                {renderContent(focusPanelId, false, false, focusSheetRef)}
              </section>
            </div>,
            document.body,
          )
        : null}

      {confirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="confirm-dialog__backdrop" role="presentation" onClick={closeConfirm}>
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
                  <button type="button" className="btn btn--soft" onClick={closeConfirm} disabled={clearLoading}>
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
