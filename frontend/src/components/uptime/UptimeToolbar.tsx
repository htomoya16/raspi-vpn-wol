import type { Pc } from '../../types/models'
import type { SummaryBucket } from './types'

interface UptimeToolbarProps {
  pcs: Pc[]
  activePcId: string
  summaryBucket: SummaryBucket
  enableUptimeMock: boolean
  useMockData: boolean
  onPcChange: (pcId: string) => void
  onBucketChange: (bucket: SummaryBucket) => void
  onToggleMock: () => void
}

function UptimeToolbar({
  pcs,
  activePcId,
  summaryBucket,
  enableUptimeMock,
  useMockData,
  onPcChange,
  onBucketChange,
  onToggleMock,
}: UptimeToolbarProps) {
  return (
    <div className="uptime-toolbar">
      <label>
        対象PC
        <select value={activePcId} onChange={(event) => onPcChange(event.target.value)}>
          {pcs.map((pc) => (
            <option key={pc.id} value={pc.id}>
              {pc.name} ({pc.id})
            </option>
          ))}
        </select>
      </label>

      <label>
        集計単位
        <select value={summaryBucket} onChange={(event) => onBucketChange(event.target.value as SummaryBucket)}>
          <option value="day">日次</option>
          <option value="month">月次</option>
          <option value="year">年次</option>
        </select>
      </label>

      {enableUptimeMock ? (
        <button
          type="button"
          className={`btn ${useMockData ? 'btn--primary' : 'btn--soft'} uptime-toolbar__mock-toggle`}
          onClick={onToggleMock}
        >
          {useMockData ? 'モック表示: ON' : 'モック表示: OFF'}
        </button>
      ) : null}
    </div>
  )
}

export default UptimeToolbar
