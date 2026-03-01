import { useState, type CSSProperties } from 'react'

import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../theme/types'

interface AppearanceOption {
  id: AppearanceMode
  label: string
  description: string
}

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: 'system', label: 'システム', description: '端末の設定に合わせます。' },
  { id: 'dark', label: 'ダーク', description: '暗い背景で表示します。' },
  { id: 'light', label: 'ライト', description: '明るい背景で表示します。' },
]

type SettingsSection = 'theme' | 'appearance'

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'theme', label: 'テーマ色' },
  { id: 'appearance', label: '外観' },
]

export interface SettingsPanelProps {
  selectedThemeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  onThemeChange: (themeId: string) => void
  onAppearanceChange: (mode: AppearanceMode) => void
  onClose?: () => void
}

function buildSwatchStyle(option: ThemeOption, effectiveAppearanceMode: EffectiveAppearanceMode): CSSProperties {
  if (option.id === 'default') {
    const solid = effectiveAppearanceMode === 'dark' ? '#121212' : '#f6f6f6'
    const border = effectiveAppearanceMode === 'dark' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(0, 0, 0, 0.2)'
    return {
      '--theme-primary': solid,
      '--theme-accent': solid,
      '--theme-solid': solid,
      '--theme-swatch-border': border,
    } as CSSProperties
  }

  return {
    '--theme-primary': option.primary,
    '--theme-accent': option.accent,
  } as CSSProperties
}

export function SettingsPanel({
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  onThemeChange,
  onAppearanceChange,
  onClose,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('theme')

  return (
    <div className="settings-panel">
      <div className="settings-dialog__header">
        <div>
          <h3>表示設定</h3>
          <p>テーマ色と外観モードを選択できます。</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="settings-dialog__close-btn"
            onClick={onClose}
            aria-label="設定を閉じる"
          >
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
            <div className="settings-dialog__section">
              <h4>テーマ色</h4>
              <div className="settings-theme-grid" role="radiogroup" aria-label="テーマ色選択">
                {themeOptions.map((option) => {
                  const selected = option.id === selectedThemeId
                  const swatchStyle = buildSwatchStyle(option, effectiveAppearanceMode)
                  const isDefault = option.id === 'default'
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`settings-theme-chip${selected ? ' settings-theme-chip--active' : ''}`}
                      onClick={() => onThemeChange(option.id)}
                    >
                      <span
                        className={`settings-theme-chip__swatch${isDefault ? ' settings-theme-chip__swatch--solid' : ''}`}
                        style={swatchStyle}
                        aria-hidden="true"
                      />
                      <span className="settings-theme-chip__label">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="settings-dialog__section">
              <h4>外観モード</h4>
              <div className="settings-appearance-list" role="radiogroup" aria-label="外観モード選択">
                {APPEARANCE_OPTIONS.map((option) => {
                  const selected = option.id === appearanceMode
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`settings-appearance-item${selected ? ' settings-appearance-item--active' : ''}`}
                      onClick={() => onAppearanceChange(option.id)}
                    >
                      <span className="settings-appearance-item__label">{option.label}</span>
                      <span className="settings-appearance-item__description">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
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
  if (!open) {
    return null
  }

  return (
    <div className="confirm-dialog__backdrop settings-dialog__backdrop" role="presentation" onClick={onClose}>
      <section
        className="confirm-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="表示設定"
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
