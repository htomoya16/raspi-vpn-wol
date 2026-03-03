import type { BusyById, Pc, PcBusyState, RowErrorById } from '../../types/models'
import LoadingDots from '../LoadingDots'
import PcRowItem from './PcRowItem'
import { STATUS_LABELS } from './constants'

interface PcListContentProps {
  items: Pc[]
  loading: boolean
  showInitialLoading: boolean
  hasActiveFilter: boolean
  detailOpen: boolean
  selectedPcId: string
  busyById: BusyById
  rowErrorById: RowErrorById
  onOpenDetail: (pcId: string) => void
  onSelectPc?: (pcId: string) => void
  onSendWol: (pcId: string) => Promise<void> | void
  onRefreshStatus: (pcId: string) => Promise<void> | void
}

function PcListContent({
  items,
  loading,
  showInitialLoading,
  hasActiveFilter,
  detailOpen,
  selectedPcId,
  busyById,
  rowErrorById,
  onOpenDetail,
  onSelectPc,
  onSendWol,
  onRefreshStatus,
}: PcListContentProps) {
  return (
    <div className="pc-list__content" aria-busy={loading}>
      {items.length === 0 ? (
        <p className="empty-state pc-list__empty">
          {hasActiveFilter ? '該当するPCがありません。' : 'PCがまだ登録されていません。'}
        </p>
      ) : (
        <ul className="pc-row-list">
          {items.map((pc) => {
            const isBusy: PcBusyState = busyById[pc.id] || {}
            const isActive = detailOpen && pc.id === selectedPcId

            return (
              <PcRowItem
                key={pc.id}
                pc={pc}
                isActive={isActive}
                isBusy={isBusy}
                statusLabel={STATUS_LABELS[pc.status]}
                rowError={rowErrorById[pc.id]}
                onOpenDetail={onOpenDetail}
                onSendWol={async (pcId) => {
                  onSelectPc?.(pcId)
                  await onSendWol(pcId)
                }}
                onRefreshStatus={async (pcId) => {
                  onSelectPc?.(pcId)
                  await onRefreshStatus(pcId)
                }}
              />
            )
          })}
        </ul>
      )}

      {showInitialLoading ? (
        <div className="pc-list__loading-overlay">
          <LoadingDots label="PC一覧を読み込み中" />
        </div>
      ) : null}
    </div>
  )
}

export default PcListContent
