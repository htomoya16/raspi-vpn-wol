import type { AppearanceMode, ThemeOption } from './types'

export const THEME_STORAGE_KEY = 'wol:theme-color'
export const APPEARANCE_STORAGE_KEY = 'wol:appearance-mode'

export const DEFAULT_THEME_ID = 'default'
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = 'system'

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'default', label: 'デフォルト', primary: '#2b2b2b', primaryStrong: '#141414', accent: '#f1f1f1' },
  { id: 'blue', label: 'ブルー', primary: '#3b82f6', primaryStrong: '#1e3a8a', accent: '#38bdf8' },
  { id: 'emerald', label: 'エメラルド', primary: '#10b981', primaryStrong: '#065f46', accent: '#34d399' },
  { id: 'orange', label: 'オレンジ', primary: '#f97316', primaryStrong: '#9a3412', accent: '#fb923c' },
  { id: 'rose', label: 'ローズ', primary: '#f43f5e', primaryStrong: '#881337', accent: '#fb7185' },
  { id: 'violet', label: 'バイオレット', primary: '#8b5cf6', primaryStrong: '#4c1d95', accent: '#a78bfa' },
  { id: 'cyan', label: 'シアン', primary: '#06b6d4', primaryStrong: '#155e75', accent: '#22d3ee' },
  { id: 'lime', label: 'ライム', primary: '#84cc16', primaryStrong: '#3f6212', accent: '#a3e635' },
  { id: 'amber', label: 'アンバー', primary: '#f59e0b', primaryStrong: '#92400e', accent: '#fbbf24' },
  { id: 'red', label: 'レッド', primary: '#ef4444', primaryStrong: '#991b1b', accent: '#f87171' },
  { id: 'slate', label: 'スレート', primary: '#64748b', primaryStrong: '#334155', accent: '#94a3b8' },
]
