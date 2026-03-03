import type { CSSProperties } from 'react'

import type { EffectiveAppearanceMode, ThemeOption } from '../../theme/types'

export function buildSwatchStyle(option: ThemeOption, effectiveAppearanceMode: EffectiveAppearanceMode): CSSProperties {
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
