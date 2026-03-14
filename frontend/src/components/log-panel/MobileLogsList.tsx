import type { LogGroup } from './logGrouping'
import { formatDetails, getActionLabel } from './logGrouping'
import { formatJstDateParts } from '../../utils/datetime'

interface MobileLogsListProps {
  logGroups: LogGroup[]
  collapsedGroupKeys: Set<string>
  expandedDetailIds: Set<number>
  onToggleGroup: (key: string) => void
  onToggleDetail: (id: number) => void
}

function formatCompactSubtitle(subtitle: string): string {
  if (!subtitle.startsWith('ID: ')) {
    return subtitle
  }
  const rawId = subtitle.slice(4).trim()
  if (rawId.length <= 18) {
    return subtitle
  }
  return `ID: ${rawId.slice(0, 8)}...${rawId.slice(-6)}`
}

export default function MobileLogsList({
  logGroups,
  collapsedGroupKeys,
  expandedDetailIds,
  onToggleGroup,
  onToggleDetail,
}: MobileLogsListProps) {
  return (
    <div className="logs-mobile-list">
      {logGroups.map((group) => {
        const collapsed = collapsedGroupKeys.has(group.key)
        return (
          <section key={group.key} className="logs-mobile-group">
            <button
              type="button"
              className={`logs-mobile-group__toggle logs-mobile-group__toggle--${group.kind}`}
              aria-expanded={!collapsed}
              onClick={() => onToggleGroup(group.key)}
            >
              <span className="logs-table__group-label">
                <span className="logs-table__group-head">
                  <span
                    className={`logs-table__group-caret${collapsed ? ' logs-table__group-caret--collapsed' : ''}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                  <span className="logs-table__group-title">
                    <span>{group.title}</span>
                    {group.subtitle ? (
                      <span className="logs-table__group-subtitle" title={group.subtitle}>
                        <span className="logs-table__group-subtitle-full">{group.subtitle}</span>
                        <span className="logs-table__group-subtitle-compact">
                          {formatCompactSubtitle(group.subtitle)}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="logs-table__group-counts">
                  <span className="logs-table__group-count logs-table__group-count--ok">OK {group.okCount}</span>
                  <span className="logs-table__group-count logs-table__group-count--ng">NG {group.ngCount}</span>
                  <span className="logs-table__group-count logs-table__group-count--total">{group.items.length}件</span>
                </span>
              </span>
            </button>

            {!collapsed ? (
              <div className="logs-mobile-group__items">
                {group.items.map((item) => {
                  const detailsText = formatDetails(item.details)
                  const hasDetails = detailsText !== '-'
                  const isExpanded = hasDetails && expandedDetailIds.has(item.id)
                  const timeParts = formatJstDateParts(item.created_at, {
                    fallbackDate: '-',
                    fallbackTime: '',
                  })
                  const timeLabel = timeParts.time ? `${timeParts.date} ${timeParts.time}` : timeParts.date

                  return (
                    <article key={item.id} className="logs-mobile-item">
                      <div className="logs-mobile-item__row logs-mobile-item__row--time">
                        <span className="logs-mobile-item__label">時刻</span>
                        <span className="logs-mobile-item__value logs-mobile-item__time">
                          <span>{timeLabel}</span>
                          <span
                            className={`logs-result-badge logs-result-badge--mobile ${item.ok ? 'logs-result-badge--ok' : 'logs-result-badge--ng'}`}
                            aria-label={item.ok ? '結果: OK' : '結果: NG'}
                          >
                            {item.ok ? 'OK' : 'NG'}
                          </span>
                        </span>
                      </div>
                      <div className="logs-mobile-item__row">
                        <span className="logs-mobile-item__label">操作</span>
                        <span className="logs-mobile-item__value">{getActionLabel(item)}</span>
                      </div>
                      <div className="logs-mobile-item__row">
                        <span className="logs-mobile-item__label">PC</span>
                        <span className="logs-mobile-item__value">{item.pc_id || '-'}</span>
                      </div>
                      <div className="logs-mobile-item__row logs-mobile-item__row--message">
                        <span className="logs-mobile-item__label">メッセージ</span>
                        <span className="logs-mobile-item__value logs-mobile-item__message">
                          <span>{item.message || '-'}</span>
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
                      </div>
                      {hasDetails && isExpanded ? (
                        <div className="logs-mobile-item__details">
                          <pre className="log-details__text log-details__text--expanded">{detailsText}</pre>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
