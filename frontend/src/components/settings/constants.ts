import type { AppearanceMode } from '../../theme/types'

export interface AppearanceOption {
  id: AppearanceMode
  label: string
  description: string
}

export const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: 'system', label: 'システム', description: '端末の設定に合わせます。' },
  { id: 'dark', label: 'ダーク', description: '暗い背景で表示します。' },
  { id: 'light', label: 'ライト', description: '明るい背景で表示します。' },
]

export type SettingsSection = 'theme' | 'appearance' | 'tokens'

export const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'theme', label: 'テーマ色' },
  { id: 'appearance', label: '外観' },
  { id: 'tokens', label: 'APIトークン' },
]
