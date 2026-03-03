import type { EffectiveAppearanceMode, ThemeOption } from '../../theme/types'
import { buildSwatchStyle } from './utils'

interface ThemeSectionProps {
  selectedThemeId: string
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  onThemeChange: (themeId: string) => void
}

function ThemeSection({ selectedThemeId, effectiveAppearanceMode, themeOptions, onThemeChange }: ThemeSectionProps) {
  return (
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
  )
}

export default ThemeSection
