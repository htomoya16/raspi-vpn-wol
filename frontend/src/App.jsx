import { useCallback, useState } from 'react'

import './App.css'
import AppHeader from './components/AppHeader'
import DesktopWorkspace from './components/workspace/DesktopWorkspace'
import MobileWorkspace from './components/workspace/MobileWorkspace'
import { useDashboardData } from './hooks/useDashboardData'
import { useMediaQuery } from './hooks/useMediaQuery'

const MOBILE_BREAKPOINT = '(max-width: 760px)'

function App() {
  const [leftView, setLeftView] = useState('list')
  const [mobileView, setMobileView] = useState('pcs')
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

  const handleCreatePc = useCallback(
    async (payload) => {
      const created = await createPcEntry(payload)
      if (created) {
        setLeftView('list')
        setMobileView('pcs')
      }
      return created
    },
    [createPcEntry],
  )

  const pcListProps = {
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
    busyById,
    rowErrorById,
    lastSyncedAt,
  }

  const logsPanelProps = {
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
        />
      ) : (
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
      )}
    </main>
  )
}

export default App
