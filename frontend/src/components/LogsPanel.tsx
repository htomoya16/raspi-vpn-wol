import { Fragment, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
  label: string
  items: LogEntry[]
}

function parseDetailsObject(details: LogEntry['details']): Record<string, unknown> | null {
  if (!details) {
    return null
  }
  if (typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>
  }
  if (typeof details === 'string') {
    try {
      const parsed: unknown = JSON.parse(details)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

function extractJobId(item: LogEntry): string | null {
  if (typeof item.job_id === 'string') {
    const normalized = item.job_id.trim()
    if (normalized) {
      return normalized
    }
  }

  const details = item.details
  const detailObject = parseDetailsObject(details)
  if (!detailObject) {
    return null
  }
  const jobId = detailObject.job_id
  if (typeof jobId !== 'string') {
    return null
  }
  const normalized = jobId.trim()
  return normalized ? normalized : null
}

function buildLogGroups(items: LogEntry[]): LogGroup[] {
  const groupMap = new Map<string, LogGroup>()

  for (const item of items) {
    const jobId = extractJobId(item)
    const key = jobId ? `job:${jobId}` : 'no-job'
    const label = jobId ? `ジョブ ${jobId}` : '通常ログ'
    const existing = groupMap.get(key)
    if (existing) {
      existing.items.push(item)
      continue
    }
    groupMap.set(key, { key, label, items: [item] })
  }

  return Array.from(groupMap.values())
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
  const hasItems = items.length > 0
  const logGroups = useMemo(() => buildLogGroups(items), [items])
  const showInitialLoading = loading && !hasItems
  const showRefreshingSpinner = useDelayedVisibility(loading && hasItems, 200)

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

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLTableRowElement>, id: number) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.preventDefault()
    toggleDetails(id)
  }

  function renderContent(titleId: string, showFocusButton: boolean, showClearButton: boolean) {
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
        <div className="logs-sheet">
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
            <tbody>
              {logGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="logs-table__group-row">
                    <td colSpan={5}>
                      <span className="logs-table__group-label">
                        <span>{group.label}</span>
                        <span>{group.items.length}件</span>
                      </span>
                    </td>
                  </tr>
                  {group.items.map((item) => {
                    const detailsText = formatDetails(item.details)
                    const hasDetails = detailsText !== '-'
                    const isExpanded = hasDetails && expandedDetailIds.has(item.id)
                    const timeParts = formatJstDateParts(item.created_at, { fallbackDate: '-', fallbackTime: '' })

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`logs-table__row${hasDetails ? ' logs-table__row--expandable' : ''}${isExpanded ? ' logs-table__row--expanded' : ''}`}
                          role={hasDetails ? 'button' : undefined}
                          tabIndex={hasDetails ? 0 : undefined}
                          aria-expanded={hasDetails ? isExpanded : undefined}
                          onClick={hasDetails ? () => toggleDetails(item.id) : undefined}
                          onKeyDown={hasDetails ? (event) => handleRowKeyDown(event, item.id) : undefined}
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
                          <td data-label="操作">{item.action}</td>
                          <td data-label="PC">{item.pc_id || '-'}</td>
                          <td data-label="結果">
                            <span className={item.ok ? 'result-ok' : 'result-ng'}>{item.ok ? 'OK' : 'NG'}</span>
                          </td>
                          <td data-label="メッセージ">
                            <span className="logs-message-cell">
                              <span className="logs-message-cell__text">{item.message || '-'}</span>
                              {hasDetails ? (
                                <span className={`logs-message-cell__hint${isExpanded ? ' logs-message-cell__hint--open' : ''}`}>
                                  {isExpanded ? 'タップで閉じる' : 'タップで詳細'}
                                </span>
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
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
  }

  return (
    <>
      {embedded ? (
        <div className="panel-embedded panel-embedded--logs">{renderContent(panelId, true, true)}</div>
      ) : (
        <section className="panel">{renderContent(panelId, true, true)}</section>
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
                {renderContent(focusPanelId, false, false)}
              </section>
            </div>,
            document.body,
          )
        : null}

      {confirmOpen ? (
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
        </div>
      ) : null}
    </>
  )
}

export default LogsPanel
