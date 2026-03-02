import { useCallback, useMemo, useState } from 'react'

import './App.css'
import AppHeader from './components/AppHeader'
import SettingsDialog from './components/SettingsDialog'
import DashboardShell from './components/app/DashboardShell'
import TokenGateScreen from './components/app/TokenGateScreen'
import type { LogsPanelProps } from './components/LogsPanel'
import type { PcListProps } from './components/PcList'
import type { LeftView } from './components/workspace/DesktopWorkspace'
import type { MobileView } from './components/workspace/MobileWorkspace'
import type { DashboardWorkspaceData } from './components/workspace/types'
import { useDashboardData } from './hooks/useDashboardData'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useThemeSettings } from './hooks/useThemeSettings'
import { useTokenValidation } from './hooks/useTokenValidation'
import { THEME_OPTIONS } from './theme/theme-options'
import type { PcCreatePayload } from './types/models'

const MOBILE_BREAKPOINT = '(max-width: 760px)'
type DesktopView = 'dashboard' | 'uptime'

function App() {
  const [leftView, setLeftView] = useState<LeftView>('list')
  const [mobileView, setMobileView] = useState<MobileView>('pcs')
  const [desktopView, setDesktopView] = useState<DesktopView>('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedPcId, setSelectedPcId] = useState('')

  const {
    hasBearerToken,
    isTokenVerified,
    isTokenValidationPending,
    isTokenInvalid,
    activeTokenName,
    activeTokenRole,
  } = useTokenValidation()
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)

  const {
    themeId,
    appearanceMode,
    effectiveAppearanceMode,
    onThemeChange,
    onAppearanceChange,
  } = useThemeSettings(THEME_OPTIONS)

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
  } = useDashboardData({ enabled: isTokenVerified })

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

  const handleOpenSettings = useCallback(() => {
    if (!hasBearerToken) {
      return
    }
    if (isMobile) {
      setMobileView('settings')
      return
    }
    setSettingsOpen(true)
  }, [hasBearerToken, isMobile])

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const toggleDesktopView = useCallback(() => {
    setDesktopView((prev) => (prev === 'dashboard' ? 'uptime' : 'dashboard'))
  }, [])

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

  const dashboardWorkspaceData: DashboardWorkspaceData = {
    pcListProps,
    createLoading,
    createError,
    onCreatePc: handleCreatePc,
    jobs,
    logsPanelProps,
  }

  return (
    <main className="app-layout">
      <AppHeader
        totalCount={isTokenVerified ? pcs.length : 0}
        onlineCount={isTokenVerified ? onlineCount : 0}
        refreshAllLoading={isTokenVerified ? refreshAllLoading : false}
        tokenConfigured={isTokenVerified}
        activeTokenName={activeTokenName}
        activeTokenRole={activeTokenRole}
        onRefreshAllStatuses={isTokenVerified ? refreshAllStatusesEntry : () => undefined}
        onOpenSettings={handleOpenSettings}
      />

      {notice ? <p className="feedback feedback--notice">{notice}</p> : null}

      {isTokenVerified ? (
        <DashboardShell
          isMobile={isMobile}
          mobileView={mobileView}
          onChangeMobileView={setMobileView}
          desktopView={desktopView}
          onToggleDesktopView={toggleDesktopView}
          leftView={leftView}
          onChangeLeftView={setLeftView}
          selectedThemeId={themeId}
          appearanceMode={appearanceMode}
          effectiveAppearanceMode={effectiveAppearanceMode}
          themeOptions={THEME_OPTIONS}
          onThemeChange={onThemeChange}
          onAppearanceChange={onAppearanceChange}
          dashboard={dashboardWorkspaceData}
          pcs={pcs}
          selectedPcId={activeSelectedPcId}
          onSelectPc={setSelectedPcId}
          uptimeDataVersion={lastSyncedAt}
        />
      ) : (
        <TokenGateScreen
          isTokenValidationPending={isTokenValidationPending}
          isTokenInvalid={isTokenInvalid}
          selectedThemeId={themeId}
          appearanceMode={appearanceMode}
          effectiveAppearanceMode={effectiveAppearanceMode}
          themeOptions={THEME_OPTIONS}
          onThemeChange={onThemeChange}
          onAppearanceChange={onAppearanceChange}
        />
      )}

      <SettingsDialog
        open={settingsOpen && !isMobile && isTokenVerified}
        selectedThemeId={themeId}
        appearanceMode={appearanceMode}
        effectiveAppearanceMode={effectiveAppearanceMode}
        themeOptions={THEME_OPTIONS}
        onThemeChange={onThemeChange}
        onAppearanceChange={onAppearanceChange}
        onClose={handleCloseSettings}
      />
    </main>
  )
}

export default App
