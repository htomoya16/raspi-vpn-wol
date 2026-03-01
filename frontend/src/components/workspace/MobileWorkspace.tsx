import JobQueue from '../JobQueue'
import LogsPanel from '../LogsPanel'
import PcForm from '../PcForm'
import PcList from '../PcList'
import { SettingsPanel } from '../SettingsDialog'
import UptimePanel from '../UptimePanel'
import homeIcon from '../icons/home.svg'
import logIcon from '../icons/log.svg'
import registerIcon from '../icons/register.svg'
import settingsIcon from '../icons/setting.svg'
import uptimeIcon from '../icons/uptime.svg'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../../theme/types'
import type { Pc } from '../../types/models'
import type { DashboardWorkspaceData } from './types'

export type MobileView = 'pcs' | 'create' | 'logs' | 'uptime' | 'settings'

interface MobileWorkspaceProps {
  mobileView: MobileView
  onChangeMobileView: (view: MobileView) => void
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

interface MobileNavItem {
  view: MobileView
  label: string
  icon: string
  variant: 'stack' | 'register'
  ariaLabel?: string
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { view: 'pcs', label: 'PC一覧', icon: homeIcon, variant: 'stack' },
  { view: 'logs', label: 'ログ', icon: logIcon, variant: 'stack' },
  { view: 'create', label: 'PC登録', icon: registerIcon, variant: 'register', ariaLabel: 'PC登録' },
  { view: 'uptime', label: '稼働時間', icon: uptimeIcon, variant: 'stack' },
  { view: 'settings', label: '設定', icon: settingsIcon, variant: 'stack', ariaLabel: '設定' },
]

function MobileWorkspace({
  mobileView,
  onChangeMobileView,
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
}: MobileWorkspaceProps) {
  const {
    pcListProps,
    createLoading,
    createError,
    onCreatePc,
    jobs,
    logsPanelProps,
  } = dashboard

  return (
    <>
      <section className="mobile-workspace">
        {mobileView === 'pcs' ? <PcList {...pcListProps} /> : null}

        {mobileView === 'create' ? (
          <PcForm loading={createLoading} error={createError} onCreate={onCreatePc} />
        ) : null}

        {mobileView === 'logs' ? (
          <div className="mobile-workspace__logs">
            <section className="panel column-panel column-panel--right">
              <JobQueue jobs={jobs} embedded />
              <LogsPanel {...logsPanelProps} embedded />
            </section>
          </div>
        ) : null}

        {mobileView === 'uptime' ? (
          <UptimePanel
            pcs={pcs}
            selectedPcId={selectedPcId}
            onSelectPc={onSelectPc}
            dataVersion={uptimeDataVersion}
          />
        ) : null}

        {mobileView === 'settings' ? (
          <section className="panel">
            <SettingsPanel
              selectedThemeId={selectedThemeId}
              appearanceMode={appearanceMode}
              effectiveAppearanceMode={effectiveAppearanceMode}
              themeOptions={themeOptions}
              onThemeChange={onThemeChange}
              onAppearanceChange={onAppearanceChange}
            />
          </section>
        ) : null}
      </section>

      <nav className="mobile-bottom-nav" aria-label="表示切替メニュー">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = mobileView === item.view
          if (item.variant === 'register') {
            return (
              <button
                key={item.view}
                type="button"
                className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--register ${active ? 'mobile-bottom-nav__btn--active' : ''}`}
                onClick={() => onChangeMobileView(item.view)}
                aria-label={item.ariaLabel ?? item.label}
              >
                <span className="mobile-bottom-nav__register-circle" aria-hidden="true">
                  <img src={item.icon} alt="" className="mobile-bottom-nav__icon mobile-bottom-nav__icon--register" />
                </span>
              </button>
            )
          }

          return (
            <button
              key={item.view}
              type="button"
              className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--stack ${active ? 'mobile-bottom-nav__btn--active' : ''}`}
              onClick={() => onChangeMobileView(item.view)}
              aria-label={item.ariaLabel}
            >
              <img src={item.icon} alt="" aria-hidden="true" className="mobile-bottom-nav__icon" />
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

export default MobileWorkspace
