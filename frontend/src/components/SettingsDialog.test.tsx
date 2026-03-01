import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { THEME_OPTIONS } from '../theme/theme-options'
import { SettingsPanel } from './SettingsDialog'

describe('SettingsPanel', () => {
  it('renders default swatch as solid monochrome based on effective appearance', () => {
    const { rerender, container } = render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="dark"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    const darkSwatch = container.querySelector('.settings-theme-chip__swatch--solid') as HTMLElement
    expect(darkSwatch).toBeInTheDocument()
    expect(darkSwatch.style.getPropertyValue('--theme-solid')).toBe('#121212')

    rerender(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    const lightSwatch = container.querySelector('.settings-theme-chip__swatch--solid') as HTMLElement
    expect(lightSwatch.style.getPropertyValue('--theme-solid')).toBe('#f6f6f6')
  })

  it('switches section and emits appearance change', async () => {
    const user = userEvent.setup()
    const onAppearanceChange = vi.fn()

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={onAppearanceChange}
      />,
    )

    await user.click(screen.getByRole('tab', { name: '外観' }))
    expect(screen.getByText('外観モード')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^ダーク/ }))
    expect(onAppearanceChange).toHaveBeenCalledWith('dark')
  })
})
