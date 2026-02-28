import { formatJstDateTime } from '../../utils/datetime'

interface PcListHeaderProps {
  lastSyncedAt: string
}

function PcListHeader({ lastSyncedAt }: PcListHeaderProps) {
  return (
    <div className="panel__header pc-list__header">
      <div>
        <h2>PC一覧</h2>
        <p>PCを選択すると詳細を開き、編集・削除できます。</p>
        <p className="pc-list__status-help">
          ステータス確認では、PCがオンラインかオフラインかを調べます。
        </p>
      </div>
      <p className="pc-list__sync">
        最終更新: {formatJstDateTime(lastSyncedAt, { fallback: '未同期' })}
      </p>
    </div>
  )
}

export default PcListHeader
