import { useCallback, useEffect, useMemo, useState } from 'react'

import { applyAppTheme } from '../theme/app-theme'
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
} from '../theme/theme-options'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../theme/types'
import { useMediaQuery } from './useMediaQuery'

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function readThemeId(themeOptions: ThemeOption[]): string {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_ID
  }
  try {
    const savedThemeId = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (savedThemeId && themeOptions.some((option) => option.id === savedThemeId)) {
      return savedThemeId
    }
  } catch {
    // noop
  }
  return DEFAULT_THEME_ID
}

function readAppearanceMode(): AppearanceMode {
  if (typeof window === 'undefined') {
    return DEFAULT_APPEARANCE_MODE
  }
  try {
    const savedAppearance = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (savedAppearance === 'system' || savedAppearance === 'dark' || savedAppearance === 'light') {
      return savedAppearance
    }
  } catch {
    // noop
  }
  return DEFAULT_APPEARANCE_MODE
}

interface UseThemeSettingsResult {
  themeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  onThemeChange: (nextThemeId: string) => void
  onAppearanceChange: (nextAppearanceMode: AppearanceMode) => void
}

export function useThemeSettings(themeOptions: ThemeOption[]): UseThemeSettingsResult {
  const [themeId, setThemeId] = useState(() => readThemeId(themeOptions))
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() => readAppearanceMode())
  const prefersDark = useMediaQuery(SYSTEM_DARK_QUERY)
  const effectiveAppearanceMode = useMemo<EffectiveAppearanceMode>(
    () => (appearanceMode === 'system' ? (prefersDark ? 'dark' : 'light') : appearanceMode),
    [appearanceMode, prefersDark],
  )

  useEffect(() => {
    applyAppTheme({
      root: document.documentElement,
      themeId,
      appearanceMode: effectiveAppearanceMode,
      themeOptions,
    })

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId)
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearanceMode)
    } catch {
      // noop
    }
  }, [appearanceMode, effectiveAppearanceMode, themeId, themeOptions])

  const handleThemeChange = useCallback((nextThemeId: string) => {
    setThemeId(nextThemeId)
  }, [])

  const handleAppearanceChange = useCallback((nextAppearanceMode: AppearanceMode) => {
    setAppearanceMode(nextAppearanceMode)
  }, [])

  return {
    themeId,
    appearanceMode,
    effectiveAppearanceMode,
    onThemeChange: handleThemeChange,
    onAppearanceChange: handleAppearanceChange,
  }
}
