import type { Pc, PcBusyState } from '../../types/models'
import { formatLocalDateTime } from '../../utils/datetime'
import LoadingDots from '../LoadingDots'

interface PcRowItemProps {
  pc: Pc
  isActive: boolean
  isBusy: PcBusyState
  statusLabel: string
  rowError?: string
  onOpenDetail: (pcId: string) => void
  onSendWol: (pcId: string) => Promise<void> | void
  onRefreshStatus: (pcId: string) => Promise<void> | void
}

function PcRowItem({
  pc,
  isActive,
  isBusy,
  statusLabel,
  rowError,
  onOpenDetail,
  onSendWol,
  onRefreshStatus,
}: PcRowItemProps) {
  return (
    <li className={`pc-row ${isActive ? 'pc-row--active' : ''}`}>
      <div className="pc-row__summary">
        <button
          type="button"
          className="pc-row__summary-trigger"
          onClick={() => onOpenDetail(pc.id)}
          aria-pressed={isActive}
          aria-label={`${pc.name} の詳細を開く`}
        >
          <div className="pc-row__summary-main">
            <p className="pc-row__name">{pc.name}</p>
            <p className="pc-row__id">{pc.id}</p>
            <p className="pc-row__tags">
              タグ: {(pc.tags || []).length > 0 ? pc.tags.join(', ') : 'なし'}
            </p>
          </div>
          <div className="pc-row__summary-meta">
            <span className={`status-badge status-badge--${pc.status}`}>{statusLabel}</span>
            <p className="pc-row__last-seen">
              最終確認: {formatLocalDateTime(pc.last_seen_at, { fallback: '未記録' })}
            </p>
          </div>
        </button>
        <div className="pc-row__list-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={(event) => {
              event.stopPropagation()
              onSendWol(pc.id)
            }}
            disabled={Boolean(isBusy.wol)}
          >
            {isBusy.wol ? <LoadingDots label="起動中" /> : '起動'}
          </button>
          <button
            type="button"
            className="btn btn--soft"
            onClick={(event) => {
              event.stopPropagation()
              onRefreshStatus(pc.id)
            }}
            disabled={Boolean(isBusy.status)}
          >
            {isBusy.status ? <LoadingDots label="状態確認中" /> : '状態確認'}
          </button>
        </div>
      </div>

      {rowError ? <p className="feedback feedback--error">{rowError}</p> : null}
    </li>
  )
}

export default PcRowItem
