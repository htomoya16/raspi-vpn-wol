import DesktopWorkspace, { type LeftView } from '../workspace/DesktopWorkspace'
import MobileWorkspace, { type MobileView } from '../workspace/MobileWorkspace'
import yajirusiIcon from '../icons/yajirusi.svg'
import UptimePanel from '../UptimePanel'
import type { DashboardWorkspaceData } from '../workspace/types'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../../theme/types'
import type { Pc } from '../../types/models'

type DesktopView = 'dashboard' | 'uptime'

interface DashboardShellProps {
  isMobile: boolean
  mobileView: MobileView
  onChangeMobileView: (view: MobileView) => void
  desktopView: DesktopView
  onToggleDesktopView: () => void
  leftView: LeftView
  onChangeLeftView: (view: LeftView) => void
  selectedThemeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  onThemeChange: (themeId: string) => void
  onAppearanceChange: (mode: AppearanceMode) => void
  dashboard: DashboardWorkspaceData
  pcs: Pc[]
  selectedPcId: string
  onSelectPc: (pcId: string) => void
  uptimeDataVersion?: string
}

function DashboardShell({
  isMobile,
  mobileView,
  onChangeMobileView,
  desktopView,
  onToggleDesktopView,
  leftView,
  onChangeLeftView,
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  onThemeChange,
  onAppearanceChange,
  dashboard,
  pcs,
  selectedPcId,
  onSelectPc,
  uptimeDataVersion,
}: DashboardShellProps) {
  if (isMobile) {
    return (
      <MobileWorkspace
        mobileView={mobileView}
        onChangeMobileView={onChangeMobileView}
        selectedThemeId={selectedThemeId}
        appearanceMode={appearanceMode}
        effectiveAppearanceMode={effectiveAppearanceMode}
        themeOptions={themeOptions}
        onThemeChange={onThemeChange}
        onAppearanceChange={onAppearanceChange}
        dashboard={dashboard}
        pcs={pcs}
        selectedPcId={selectedPcId}
        onSelectPc={onSelectPc}
        uptimeDataVersion={uptimeDataVersion}
      />
    )
  }

  return (
    <div className={`desktop-stage desktop-stage--${desktopView}`}>
      <div className="desktop-stage__track">
        <div className="desktop-stage__page">
          <DesktopWorkspace
            leftView={leftView}
            onChangeLeftView={onChangeLeftView}
            dashboard={dashboard}
          />
        </div>
        <div className="desktop-stage__page">
          <UptimePanel
            pcs={pcs}
            selectedPcId={selectedPcId}
            onSelectPc={onSelectPc}
            dataVersion={uptimeDataVersion}
            enabled={desktopView === 'uptime'}
          />
        </div>
      </div>
      <button
        type="button"
        className={`desktop-uptime-switch ${desktopView === 'uptime' ? 'desktop-uptime-switch--back desktop-uptime-switch--left' : ''}`}
        onClick={onToggleDesktopView}
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
  )
}

export default DashboardShell
