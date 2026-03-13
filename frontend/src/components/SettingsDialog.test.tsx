import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/http'
import { THEME_OPTIONS } from '../theme/theme-options'
import { SettingsPanel } from './SettingsDialog'

const listApiTokensMock = vi.hoisted(() => vi.fn())
const createApiTokenMock = vi.hoisted(() => vi.fn())
const revokeApiTokenMock = vi.hoisted(() => vi.fn())
const deleteApiTokenMock = vi.hoisted(() => vi.fn())
const getCurrentApiActorMock = vi.hoisted(() => vi.fn())
const getStoredBearerTokenMock = vi.hoisted(() => vi.fn())
const setStoredBearerTokenMock = vi.hoisted(() => vi.fn())

vi.mock('../api/adminTokens', () => ({
  listApiTokens: (...args: unknown[]) => listApiTokensMock(...args),
  createApiToken: (...args: unknown[]) => createApiTokenMock(...args),
  revokeApiToken: (...args: unknown[]) => revokeApiTokenMock(...args),
  deleteApiToken: (...args: unknown[]) => deleteApiTokenMock(...args),
}))

vi.mock('../api/auth', () => ({
  getStoredBearerToken: (...args: unknown[]) => getStoredBearerTokenMock(...args),
  setStoredBearerToken: (...args: unknown[]) => setStoredBearerTokenMock(...args),
}))

vi.mock('../api/authMe', () => ({
  getCurrentApiActor: (...args: unknown[]) => getCurrentApiActorMock(...args),
}))

describe('SettingsPanel', () => {
  beforeEach(() => {
    listApiTokensMock.mockReset()
    createApiTokenMock.mockReset()
    revokeApiTokenMock.mockReset()
    deleteApiTokenMock.mockReset()
    getCurrentApiActorMock.mockReset()
    getStoredBearerTokenMock.mockReset()
    setStoredBearerTokenMock.mockReset()
    getStoredBearerTokenMock.mockReturnValue('')
    getCurrentApiActorMock.mockResolvedValue({
      token_id: 'token-id',
      token_name: 'test-device',
      token_role: 'device',
    })
    listApiTokensMock.mockResolvedValue({ items: [] })
  })

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

  it('opens api token section first when initialSection is tokens', async () => {
    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        initialSection="tokens"
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(listApiTokensMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('heading', { name: 'APIトークン' })).toBeInTheDocument()
  })

  it('loads token list when API token section is opened', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-1',
          name: 'iphone-shortcut',
          role: 'device',
          token_prefix: 'wol_12345678',
          created_at: '2026-03-02T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))

    await waitFor(() => {
      expect(listApiTokensMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('iphone-shortcut')).toBeInTheDocument()
    expect(screen.getByText('DEVICE')).toBeInTheDocument()
    expect(screen.getByText('有効トークン: 1 件')).toBeInTheDocument()
    expect(screen.getAllByText('管理者専用').length).toBeGreaterThan(0)
  })

  it('auto-saves first created token when no active token exists', async () => {
    const user = userEvent.setup()
    createApiTokenMock.mockResolvedValue({
      token: {
        id: 'token-2',
        name: 'iphone-action-button',
        role: 'device',
        token_prefix: 'wol_abcd1234',
        created_at: '2026-03-02T00:00:00+00:00',
        expires_at: null,
        last_used_at: null,
        revoked_at: null,
      },
      plain_token: 'wol_plain_secret',
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await user.type(screen.getByLabelText('端末名'), 'iphone-action-button')
    await user.click(screen.getByRole('button', { name: 'トークンを発行' }))

    await waitFor(() => {
      expect(createApiTokenMock).toHaveBeenCalledWith({
        name: 'iphone-action-button',
        role: 'device',
        expires_at: null,
      })
    })
    expect(setStoredBearerTokenMock).toHaveBeenCalledWith('wol_plain_secret')
    expect(screen.getByText('初回トークンを発行し、この端末へ自動設定しました。')).toBeInTheDocument()
    expect(screen.getByText('初回トークンを自動設定しました。')).toBeInTheDocument()
    expect(screen.getByText('作成した平文トークン（1回のみ表示）')).toBeInTheDocument()
    expect(screen.getByText('wol_plain_secret')).toBeInTheDocument()
  })

  it('does not auto-save created token when active token already exists', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-admin-1',
          name: 'existing-admin',
          role: 'admin',
          token_prefix: 'wol_existing',
          created_at: '2026-03-01T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })
    createApiTokenMock.mockResolvedValue({
      token: {
        id: 'token-2',
        name: 'iphone-action-button',
        role: 'device',
        token_prefix: 'wol_abcd1234',
        created_at: '2026-03-02T00:00:00+00:00',
        expires_at: null,
        last_used_at: null,
        revoked_at: null,
      },
      plain_token: 'wol_plain_secret',
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await waitFor(() => {
      expect(listApiTokensMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('existing-admin')).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText('端末名'), 'iphone-action-button')
    await user.click(screen.getByRole('button', { name: 'トークンを発行' }))

    await waitFor(() => {
      expect(createApiTokenMock).toHaveBeenCalledWith({
        name: 'iphone-action-button',
        role: 'device',
        expires_at: null,
      })
    })
    expect(setStoredBearerTokenMock).not.toHaveBeenCalled()
    expect(screen.getByText('トークンを発行しました。利用する場合は入力欄に貼り付けて保存してください。')).toBeInTheDocument()
    expect(screen.getByText('wol_plain_secret')).toBeInTheDocument()
  })

  it('allows resetting token expiration back to unlimited before issuing', async () => {
    const user = userEvent.setup()
    createApiTokenMock.mockResolvedValue({
      token: {
        id: 'token-3',
        name: 'iphone-expire-reset',
        role: 'device',
        token_prefix: 'wol_expreset',
        created_at: '2026-03-02T00:00:00+00:00',
        expires_at: null,
        last_used_at: null,
        revoked_at: null,
      },
      plain_token: 'wol_plain_expreset',
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await user.type(screen.getByLabelText('端末名'), 'iphone-expire-reset')
    await user.type(screen.getByLabelText('有効期限（任意）'), '2026-03-31')
    await user.click(screen.getByRole('button', { name: '無期限に戻す' }))
    await user.click(screen.getByRole('button', { name: 'トークンを発行' }))

    await waitFor(() => {
      expect(createApiTokenMock).toHaveBeenCalledWith({
        name: 'iphone-expire-reset',
        role: 'device',
        expires_at: null,
      })
    })
  })

  it('rejects past date for token expiration', async () => {
    const user = userEvent.setup()

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await user.type(screen.getByLabelText('端末名'), 'iphone-past-date')
    await user.type(screen.getByLabelText('有効期限（任意）'), '2000-01-01')
    await user.click(screen.getByRole('button', { name: 'トークンを発行' }))

    expect(createApiTokenMock).not.toHaveBeenCalled()
    expect(screen.getByText('有効期限に過去の日付は指定できません')).toBeInTheDocument()
  })

  it('shows success message when bearer token is saved', async () => {
    const user = userEvent.setup()

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await user.type(screen.getByLabelText('現在利用するBearerトークン'), 'wol_saved_token')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(getCurrentApiActorMock).toHaveBeenCalledWith('wol_saved_token')
      expect(setStoredBearerTokenMock).toHaveBeenCalledWith('wol_saved_token')
    })
    expect(await screen.findByText('Bearerトークンを保存しました。')).toBeInTheDocument()
  })

  it('does not save bearer token when token is invalid', async () => {
    const user = userEvent.setup()
    getCurrentApiActorMock.mockRejectedValue(new ApiError(401, 'invalid bearer token', 'invalid bearer token'))

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await user.type(screen.getByLabelText('現在利用するBearerトークン'), 'wol_invalid_token')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(getCurrentApiActorMock).toHaveBeenCalledWith('wol_invalid_token')
    })
    expect(setStoredBearerTokenMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Bearerトークンが無効です。')).toBeInTheDocument()
  })

  it('hides admin-only panels immediately when bearer token is cleared', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-1',
          name: 'admin-console',
          role: 'admin',
          token_prefix: 'wol_admin0001',
          created_at: '2026-03-02T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'トークンを発行' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'クリア' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Bearerトークンをクリアしますか？')).toBeInTheDocument()
    expect(setStoredBearerTokenMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'クリアする' }))

    expect(setStoredBearerTokenMock).toHaveBeenCalledWith('')
    const clearedMessage = screen.getByText('Bearerトークンをクリアしました。')
    expect(clearedMessage).toBeInTheDocument()
    expect(clearedMessage).toHaveClass('feedback--cleared')
    expect(screen.queryByRole('button', { name: 'トークンを発行' })).not.toBeInTheDocument()
  })

  it('opens revoke confirm dialog and revokes token', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-active-1',
          name: 'iphone-main',
          role: 'device',
          token_prefix: 'wol_active12',
          created_at: '2026-03-01T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })
    revokeApiTokenMock.mockResolvedValue({
      token_id: 'token-active-1',
      revoked_at: '2026-03-04T00:00:00+00:00',
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await waitFor(() => {
      expect(screen.getByText('iphone-main')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '失効' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('トークンを失効しますか？')).toBeInTheDocument()
    expect(revokeApiTokenMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '失効する' }))
    await waitFor(() => {
      expect(revokeApiTokenMock).toHaveBeenCalledWith('token-active-1')
    })
  })

  it('hides admin-only panels when device token cannot access admin APIs', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockRejectedValue(new ApiError(403, 'insufficient scope', 'insufficient scope'))

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))

    await waitFor(() => {
      expect(listApiTokensMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('button', { name: 'トークンを発行' })).not.toBeInTheDocument()
  })

  it('renders admin role badge for admin token', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-admin-1',
          name: 'break-glass-admin',
          role: 'admin',
          token_prefix: 'wol_admin1234',
          created_at: '2026-03-02T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await waitFor(() => {
      expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })
  })

  it('opens delete confirm dialog and deletes revoked token', async () => {
    const user = userEvent.setup()
    listApiTokensMock.mockResolvedValue({
      items: [
        {
          id: 'token-revoked-1',
          name: 'old-iphone',
          role: 'device',
          token_prefix: 'wol_revoked12',
          created_at: '2026-03-01T00:00:00+00:00',
          expires_at: null,
          last_used_at: null,
          revoked_at: '2026-03-02T00:00:00+00:00',
        },
      ],
    })
    deleteApiTokenMock.mockResolvedValue({
      deleted_token_id: 'token-revoked-1',
      deleted: true,
    })

    render(
      <SettingsPanel
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={THEME_OPTIONS}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'APIトークン' }))
    await waitFor(() => {
      expect(screen.getByText('old-iphone')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('トークンを削除しますか？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => {
      expect(deleteApiTokenMock).toHaveBeenCalledWith('token-revoked-1')
    })
    expect(screen.queryByText('トークンを削除しますか？')).not.toBeInTheDocument()
  })
})
