import { useMediaQuery } from '../hooks/useMediaQuery'
import type { Pc } from '../types/models'
import UptimeSummarySection from './uptime/UptimeSummarySection'
import UptimeTimelineSection from './uptime/UptimeTimelineSection'
import UptimeToolbar from './uptime/UptimeToolbar'
import { useUptimePanelState } from './uptime/useUptimePanelState'
import { toIsoDateLocal } from './uptime/utils'

interface UptimePanelProps {
  pcs: Pc[]
  selectedPcId: string
  onSelectPc: (pcId: string) => void
  dataVersion?: string
  embedded?: boolean
  enabled?: boolean
}

function UptimePanel({
  pcs,
  selectedPcId,
  onSelectPc,
  dataVersion = '',
  embedded = false,
  enabled = true,
}: UptimePanelProps) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const todayIso = toIsoDateLocal(new Date())
  const state = useUptimePanelState({
    pcs,
    selectedPcId,
    dataVersion,
    isMobile,
    enabled,
  })

  const content = (
    <>
      <div className="panel__header">
        <h2>稼働時間</h2>
        <p>オンライン集計と稼働タイムラインを確認できます。</p>
      </div>

      {pcs.length === 0 ? (
        <p className="empty-state">PCがまだ登録されていません。</p>
      ) : (
        <>
          <UptimeToolbar
            pcs={pcs}
            activePcId={state.activePcId}
            referenceDate={state.referenceDate}
            maxReferenceDate={todayIso}
            summaryBucket={state.summaryBucket}
            enableUptimeMock={state.enableUptimeMock}
            useMockData={state.useMockData}
            onPcChange={(nextPcId) => state.handlePcSelectionChange(nextPcId, onSelectPc)}
            onReferenceDateChange={state.changeReferenceDate}
            onBucketChange={state.changeSummaryBucket}
            onToggleMock={state.handleToggleMockData}
          />

          <UptimeSummarySection
            isMobile={state.isMobile}
            dateRangeLabel={state.summaryDateRangeLabel}
            summaryError={state.summaryError}
            summaryLoading={state.summaryLoading}
            summaryItems={state.summaryItems}
            summarySlide={state.summarySlide}
            summaryAxisTicks={state.summaryAxisTicks}
            summaryAveragePercent={state.summaryAveragePercent}
            summaryAverageSeconds={state.summaryAverageSeconds}
            summaryMaxSeconds={state.summaryMaxSeconds}
            summaryGridStyle={state.summaryGridStyle}
            summaryBucket={state.summaryBucket}
            isSummaryNextDisabled={state.isSummaryNextDisabled}
            onMoveSummary={state.moveSummary}
            onTouchStart={state.handleSummaryTouchStart}
            onTouchEnd={state.handleSummaryTouchEnd}
            onTouchCancel={state.handleSummaryTouchCancel}
          />

          <UptimeTimelineSection
            isMobile={state.isMobile}
            weeklyData={state.weeklyData}
            visibleTimelineDays={state.visibleTimelineDays}
            activeTimelineDay={state.activeTimelineDay}
            weeklyLoading={state.weeklyLoading}
            weeklyError={state.weeklyError}
            weeklySlide={state.weeklySlide}
            isTimelineNextDisabled={state.isTimelineNextDisabled}
            hourMarkers={state.hourMarkers}
            onMoveTimeline={state.moveTimeline}
            onTouchStart={state.handleTimelineTouchStart}
            onTouchEnd={state.handleTimelineTouchEnd}
            onTouchCancel={state.handleTimelineTouchCancel}
          />
        </>
      )}
    </>
  )

  if (embedded) {
    return <div className="panel-embedded panel-embedded--uptime">{content}</div>
  }

  return <section className="panel panel--uptime">{content}</section>
}

export default UptimePanel
