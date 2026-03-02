import type { AppearanceMode } from '../../theme/types'
import { APPEARANCE_OPTIONS } from './constants'

interface AppearanceSectionProps {
  appearanceMode: AppearanceMode
  onAppearanceChange: (mode: AppearanceMode) => void
}

function AppearanceSection({ appearanceMode, onAppearanceChange }: AppearanceSectionProps) {
  return (
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
  )
}

export default AppearanceSection
