import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { THEME_OPTIONS } from '../theme/theme-options'
import { useThemeSettings } from './useThemeSettings'

const applyAppThemeMock = vi.fn()

vi.mock('../theme/app-theme', () => ({
  applyAppTheme: (...args: unknown[]) => applyAppThemeMock(...args),
}))

function setMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

describe('useThemeSettings', () => {
  beforeEach(() => {
    applyAppThemeMock.mockReset()
    window.localStorage.clear()
    setMatchMedia(false)
  })

  it('reads persisted values and resolves system mode by media query', async () => {
    window.localStorage.setItem('wol:theme-color', 'emerald')
    window.localStorage.setItem('wol:appearance-mode', 'system')
    setMatchMedia(true)

    const { result } = renderHook(() => useThemeSettings(THEME_OPTIONS))

    await waitFor(() => {
      expect(applyAppThemeMock).toHaveBeenCalled()
    })

    expect(result.current.themeId).toBe('emerald')
    expect(result.current.appearanceMode).toBe('system')
    expect(result.current.effectiveAppearanceMode).toBe('dark')
    expect(applyAppThemeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        themeId: 'emerald',
        appearanceMode: 'dark',
      }),
    )
  })

  it('falls back to default values when persisted values are invalid', () => {
    window.localStorage.setItem('wol:theme-color', 'invalid-theme')
    window.localStorage.setItem('wol:appearance-mode', 'invalid-mode')

    const { result } = renderHook(() => useThemeSettings(THEME_OPTIONS))

    expect(result.current.themeId).toBe('default')
    expect(result.current.appearanceMode).toBe('system')
    expect(result.current.effectiveAppearanceMode).toBe('light')
  })

  it('updates localStorage and reapplies theme when settings change', async () => {
    const { result } = renderHook(() => useThemeSettings(THEME_OPTIONS))

    await act(async () => {
      result.current.onThemeChange('red')
      result.current.onAppearanceChange('dark')
    })

    await waitFor(() => {
      expect(window.localStorage.getItem('wol:theme-color')).toBe('red')
    })
    expect(window.localStorage.getItem('wol:appearance-mode')).toBe('dark')
    expect(applyAppThemeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        themeId: 'red',
        appearanceMode: 'dark',
      }),
    )
  })
})
