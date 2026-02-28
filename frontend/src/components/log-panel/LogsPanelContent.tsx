import { Fragment, type RefObject } from 'react'

import type { LogEntry } from '../../types/models'
import { formatJstDateParts } from '../../utils/datetime'
import LoadingDots from '../LoadingDots'
import LoadingSpinner from '../LoadingSpinner'
import type { LogGroup } from './logGrouping'
import { formatDetails, getActionLabel } from './logGrouping'

interface LogsPanelContentProps {
  titleId: string
  items: LogEntry[]
  loading: boolean
  error: string
  clearLoading: boolean
  showInitialLoading: boolean
  showRefreshingSpinner: boolean
  showFocusButton: boolean
  showClearButton: boolean
  logGroups: LogGroup[]
  collapsedGroupKeys: Set<string>
  expandedDetailIds: Set<number>
  sheetRef: RefObject<HTMLDivElement | null>
  onReload: () => Promise<void> | void
  onOpenFocus: () => void
  onOpenConfirm: () => void
  onToggleGroup: (key: string) => void
  onToggleDetail: (id: number) => void
}

function LogsPanelContent({
  titleId,
  items,
  loading,
  error,
  clearLoading,
  showInitialLoading,
  showRefreshingSpinner,
  showFocusButton,
  showClearButton,
  logGroups,
  collapsedGroupKeys,
  expandedDetailIds,
  sheetRef,
  onReload,
  onOpenFocus,
  onOpenConfirm,
  onToggleGroup,
  onToggleDetail,
}: LogsPanelContentProps) {
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
            onClick={onOpenConfirm}
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
                        onClick={onOpenFocus}
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
                      onClick={() => onToggleGroup(group.key)}
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
                            {group.subtitle ? (
                              <span className="logs-table__group-subtitle">{group.subtitle}</span>
                            ) : null}
                          </span>
                        </span>
                        <span className="logs-table__group-counts">
                          <span className="logs-table__group-count logs-table__group-count--ok">
                            OK {group.okCount}
                          </span>
                          <span className="logs-table__group-count logs-table__group-count--ng">
                            NG {group.ngCount}
                          </span>
                          <span className="logs-table__group-count logs-table__group-count--total">
                            {group.items.length}件
                          </span>
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
                                  {timeParts.time ? (
                                    <span className="logs-time-cell__time">{timeParts.time}</span>
                                  ) : null}
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
                              <span className={item.ok ? 'result-ok' : 'result-ng'}>
                                {item.ok ? 'OK' : 'NG'}
                              </span>
                            </td>
                            <td data-label="メッセージ">
                              <span className="logs-message-cell">
                                <span className="logs-message-cell__text">{item.message || '-'}</span>
                                {hasDetails ? (
                                  <button
                                    type="button"
                                    className={`logs-message-cell__hint${isExpanded ? ' logs-message-cell__hint--open' : ''}`}
                                    onClick={() => onToggleDetail(item.id)}
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
                                  <pre className="log-details__text log-details__text--expanded">
                                    {detailsText}
                                  </pre>
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

export default LogsPanelContent
