import { Fragment, useState, type KeyboardEvent } from 'react'

import LoadingDots from './LoadingDots'
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<number>>(() => new Set())

  function openConfirm() {
    setConfirmOpen(true)
  }

  function closeConfirm() {
    if (clearLoading) {
      return
    }
    setConfirmOpen(false)
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

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, id: number) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.preventDefault()
    toggleDetails(id)
  }

  const content = (
    <>
      <div className="panel__header">
        <h2>操作ログ</h2>
        <p>最新ログを1シートで確認できます。</p>
      </div>

      <div className="logs-toolbar">
        <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading || clearLoading}>
          {loading ? <LoadingDots label="読み込み中" /> : '再読込'}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={openConfirm}
          disabled={items.length === 0 || loading || clearLoading}
        >
          ログ消去
        </button>
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
                <th>メッセージ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
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
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  return (
    <>
      {embedded ? <div className="panel-embedded panel-embedded--logs">{content}</div> : <section className="panel">{content}</section>}

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
