import { applyDefaultTheme } from './default-theme'
import { applyPaletteTheme } from './palette-theme'
import type { EffectiveAppearanceMode, ThemeOption } from './types'

interface ApplyAppThemeOptions {
  root: HTMLElement
  themeId: string
  appearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
}

function resolveThemeOption(themeId: string, themeOptions: ThemeOption[]): ThemeOption {
  return themeOptions.find((themeOption) => themeOption.id === themeId) ?? themeOptions[0]
}

export function applyAppTheme({ root, themeId, appearanceMode, themeOptions }: ApplyAppThemeOptions): void {
  if (themeId === 'default') {
    applyDefaultTheme(root, appearanceMode)
    root.dataset.appearance = appearanceMode
    return
  }

  const selectedTheme = resolveThemeOption(themeId, themeOptions)
  applyPaletteTheme(root, appearanceMode, selectedTheme)
  root.dataset.appearance = appearanceMode
}

export type { EffectiveAppearanceMode }
