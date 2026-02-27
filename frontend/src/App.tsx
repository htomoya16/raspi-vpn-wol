import { useCallback, useMemo, useState } from 'react'

import './App.css'
import AppHeader from './components/AppHeader'
import DesktopWorkspace from './components/workspace/DesktopWorkspace'
import MobileWorkspace from './components/workspace/MobileWorkspace'
import yajirusiIcon from './components/icons/yajirusi.svg'
import type { LogsPanelProps } from './components/LogsPanel'
import type { PcListProps } from './components/PcList'
import UptimePanel from './components/UptimePanel'
import type { LeftView } from './components/workspace/DesktopWorkspace'
import type { MobileView } from './components/workspace/MobileWorkspace'
import { useDashboardData } from './hooks/useDashboardData'
import { useMediaQuery } from './hooks/useMediaQuery'
import type { PcCreatePayload } from './types/models'

const MOBILE_BREAKPOINT = '(max-width: 760px)'
type DesktopView = 'dashboard' | 'uptime'

function App() {
  const [leftView, setLeftView] = useState<LeftView>('list')
  const [mobileView, setMobileView] = useState<MobileView>('pcs')
  const [desktopView, setDesktopView] = useState<DesktopView>('dashboard')
  const [selectedPcId, setSelectedPcId] = useState('')
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)
  const {
    notice,
    pcs,
    pcLoading,
    pcError,
    pcFilters,
    appliedPcFilters,
    createLoading,
    createError,
    busyById,
    rowErrorById,
    logs,
    logsLoading,
    logsError,
    jobs,
    refreshAllLoading,
    lastSyncedAt,
    onlineCount,
    loadPcs,
    loadLogs,
    createPcEntry,
    deletePcEntry,
    updatePcEntry,
    refreshPcStatusEntry,
    sendPcWolEntry,
    refreshAllStatusesEntry,
    clearLogsEntry,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  } = useDashboardData()

  const activeSelectedPcId = useMemo(() => {
    if (pcs.length === 0) {
      return ''
    }
    const exists = pcs.some((pc) => pc.id === selectedPcId)
    if (exists) {
      return selectedPcId
    }
    return pcs[0].id
  }, [pcs, selectedPcId])

  const handleCreatePc = useCallback(
    async (payload: PcCreatePayload) => {
      const created = await createPcEntry(payload)
      if (created) {
        setLeftView('list')
        setMobileView('pcs')
        setDesktopView('dashboard')
      }
      return created
    },
    [createPcEntry],
  )

  const pcListProps: PcListProps = {
    items: pcs,
    loading: pcLoading,
    error: pcError,
    filters: pcFilters,
    appliedFilters: appliedPcFilters,
    onFilterChange: handleFilterChange,
    onApplyFilters: handleApplyFilters,
    onClearFilters: handleClearFilters,
    onReload: loadPcs,
    onRefreshStatus: refreshPcStatusEntry,
    onSendWol: sendPcWolEntry,
    onDelete: deletePcEntry,
    onUpdate: updatePcEntry,
    onSelectPc: setSelectedPcId,
    busyById,
    rowErrorById,
    lastSyncedAt,
  }

  const logsPanelProps: LogsPanelProps = {
    items: logs,
    loading: logsLoading,
    error: logsError,
    onReload: loadLogs,
    onClear: clearLogsEntry,
  }

  return (
    <main className="app-layout">
      <AppHeader
        totalCount={pcs.length}
        onlineCount={onlineCount}
        refreshAllLoading={refreshAllLoading}
        onRefreshAllStatuses={refreshAllStatusesEntry}
      />

      {notice ? <p className="feedback feedback--notice">{notice}</p> : null}

      {isMobile ? (
        <MobileWorkspace
          mobileView={mobileView}
          onChangeMobileView={setMobileView}
          pcListProps={pcListProps}
          createLoading={createLoading}
          createError={createError}
          onCreatePc={handleCreatePc}
          jobs={jobs}
          logsPanelProps={logsPanelProps}
          pcs={pcs}
          selectedPcId={activeSelectedPcId}
          onSelectPc={setSelectedPcId}
          uptimeDataVersion={lastSyncedAt}
        />
      ) : (
        <div className={`desktop-stage desktop-stage--${desktopView}`}>
          <div className="desktop-stage__track">
            <div className="desktop-stage__page">
              <DesktopWorkspace
                leftView={leftView}
                onChangeLeftView={setLeftView}
                pcListProps={pcListProps}
                createLoading={createLoading}
                createError={createError}
                onCreatePc={handleCreatePc}
                jobs={jobs}
                logsPanelProps={logsPanelProps}
              />
            </div>
            <div className="desktop-stage__page">
              <UptimePanel
                pcs={pcs}
                selectedPcId={activeSelectedPcId}
                onSelectPc={setSelectedPcId}
                dataVersion={lastSyncedAt}
              />
            </div>
          </div>
          <button
            type="button"
            className={`desktop-uptime-switch ${desktopView === 'uptime' ? 'desktop-uptime-switch--back desktop-uptime-switch--left' : ''}`}
            onClick={() => setDesktopView((prev) => (prev === 'dashboard' ? 'uptime' : 'dashboard'))}
            aria-label={desktopView === 'dashboard' ? '稼働時間ページへ移動' : 'ダッシュボードへ戻る'}
          >
            <img
              src={yajirusiIcon}
              alt=""
              aria-hidden="true"
              className={`desktop-uptime-switch__icon ${desktopView === 'uptime' ? 'desktop-uptime-switch__icon--left' : 'desktop-uptime-switch__icon--right'}`}
            />
          </button>
        </div>
      )}
    </main>
  )
}

export default App
