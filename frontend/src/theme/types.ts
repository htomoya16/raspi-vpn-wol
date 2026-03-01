export interface ThemeOption {
  id: string
  label: string
  primary: string
  primaryStrong: string
  accent: string
}

export type AppearanceMode = 'system' | 'dark' | 'light'
export type EffectiveAppearanceMode = Exclude<AppearanceMode, 'system'>
