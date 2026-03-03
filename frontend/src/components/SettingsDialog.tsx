import { useEffect, useState } from 'react'

import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useAdminTokens } from '../hooks/useAdminTokens'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../theme/types'
import AppearanceSection from './settings/AppearanceSection'
import { SETTINGS_SECTIONS, type SettingsSection } from './settings/constants'
import ThemeSection from './settings/ThemeSection'
import TokensSection from './settings/TokensSection'

export interface SettingsPanelProps {
  selectedThemeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  initialSection?: SettingsSection
  onThemeChange: (themeId: string) => void
  onAppearanceChange: (mode: AppearanceMode) => void
  onClose?: () => void
}

export function SettingsPanel({
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  initialSection = 'theme',
  onThemeChange,
  onAppearanceChange,
  onClose,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const tokens = useAdminTokens(activeSection === 'tokens')

  useEffect(() => {
    setActiveSection(initialSection)
  }, [initialSection])

  const panelClassName = `settings-panel ${onClose ? 'settings-panel--dialog' : 'settings-panel--embedded'}`

  return (
    <div className={panelClassName}>
      <div className="settings-dialog__header">
        <div>
          <h3>設定</h3>
          <p>テーマ色・外観・APIトークンを設定できます。</p>
        </div>
        {onClose ? (
          <button type="button" className="settings-dialog__close-btn" onClick={onClose} aria-label="設定を閉じる">
            ×
          </button>
        ) : null}
      </div>

      <div className="settings-dialog__body">
        <aside className="settings-dialog__menu" role="tablist" aria-orientation="vertical" aria-label="設定メニュー">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`settings-dialog__menu-item${activeSection === section.id ? ' settings-dialog__menu-item--active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </aside>

        <section className="settings-dialog__content" role="tabpanel">
          {activeSection === 'theme' ? (
            <ThemeSection
              selectedThemeId={selectedThemeId}
              effectiveAppearanceMode={effectiveAppearanceMode}
              themeOptions={themeOptions}
              onThemeChange={onThemeChange}
            />
          ) : activeSection === 'appearance' ? (
            <AppearanceSection appearanceMode={appearanceMode} onAppearanceChange={onAppearanceChange} />
          ) : (
            <TokensSection tokens={tokens} />
          )}
        </section>
      </div>
    </div>
  )
}

interface SettingsDialogProps extends SettingsPanelProps {
  open: boolean
  onClose: () => void
}

function SettingsDialog({
  open,
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  onClose,
  onThemeChange,
  onAppearanceChange,
}: SettingsDialogProps) {
  useBodyScrollLock(open, { strategy: 'fixed' })

  if (!open) {
    return null
  }

  return (
    <div className="confirm-dialog__backdrop settings-dialog__backdrop" role="presentation" onClick={onClose}>
      <section
        className="confirm-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        onClick={(event) => event.stopPropagation()}
      >
        <SettingsPanel
          selectedThemeId={selectedThemeId}
          appearanceMode={appearanceMode}
          effectiveAppearanceMode={effectiveAppearanceMode}
          themeOptions={themeOptions}
          onThemeChange={onThemeChange}
          onAppearanceChange={onAppearanceChange}
          onClose={onClose}
        />
      </section>
    </div>
  )
}

export default SettingsDialog
