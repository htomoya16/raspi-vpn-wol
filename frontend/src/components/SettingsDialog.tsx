import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { createApiToken, deleteApiToken, listApiTokens, revokeApiToken } from '../api/adminTokens'
import { getCurrentApiActor } from '../api/authMe'
import { getStoredBearerToken, setStoredBearerToken } from '../api/auth'
import { ApiError, formatApiError } from '../api/http'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../theme/types'
import type { ApiToken } from '../types/models'

interface AppearanceOption {
  id: AppearanceMode
  label: string
  description: string
}

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: 'system', label: 'システム', description: '端末の設定に合わせます。' },
  { id: 'dark', label: 'ダーク', description: '暗い背景で表示します。' },
  { id: 'light', label: 'ライト', description: '明るい背景で表示します。' },
]

type SettingsSection = 'theme' | 'appearance' | 'tokens'

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'theme', label: 'テーマ色' },
  { id: 'appearance', label: '外観' },
  { id: 'tokens', label: 'APIトークン' },
]

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  if (typeof document === 'undefined') {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

export interface SettingsPanelProps {
  selectedThemeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  initialSection?: SettingsSection
  onThemeChange: (themeId: string) => void
  onAppearanceChange: (mode: AppearanceMode) => void
  onClose?: () => void
}

function buildSwatchStyle(option: ThemeOption, effectiveAppearanceMode: EffectiveAppearanceMode): CSSProperties {
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

export function SettingsPanel({
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  initialSection = 'theme',
  onThemeChange,
  onAppearanceChange,
  onClose,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [tokensError, setTokensError] = useState('')
  const [tokenAccessDenied, setTokenAccessDenied] = useState(false)
  const [currentBearerToken, setCurrentBearerToken] = useState(() => getStoredBearerToken())
  const [bearerSaving, setBearerSaving] = useState(false)
  const [bearerFeedback, setBearerFeedback] = useState<{ kind: 'success' | 'error' | 'cleared'; message: string } | null>(null)
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState<'device' | 'admin'>('device')
  const [createExpiresAt, setCreateExpiresAt] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createFeedback, setCreateFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [createdPlainToken, setCreatedPlainToken] = useState('')
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null)
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null)
  const [deleteTargetToken, setDeleteTargetToken] = useState<ApiToken | null>(null)

  useEffect(() => {
    setActiveSection(initialSection)
  }, [initialSection])

  const loadTokens = useCallback(async () => {
    setTokensLoading(true)
    setTokensError('')
    try {
      const response = await listApiTokens()
      setApiTokens(response.items)
      setTokenAccessDenied(false)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setApiTokens([])
        setTokenAccessDenied(true)
        setTokensError('')
        return
      }
      setTokenAccessDenied(false)
      setTokensError(formatApiError(error))
    } finally {
      setTokensLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSection === 'tokens') {
      void loadTokens()
    }
  }, [activeSection, loadTokens])

  const activeTokenCount = useMemo(
    () => apiTokens.filter((token) => token.revoked_at == null && !isExpired(token.expires_at)).length,
    [apiTokens],
  )

  const handleSaveBearerToken = useCallback(async () => {
    const normalized = currentBearerToken.trim()
    if (!normalized) {
      setBearerFeedback({ kind: 'error', message: '保存するBearerトークンを入力してください。' })
      return
    }

    setBearerSaving(true)
    try {
      await getCurrentApiActor(normalized)
      setStoredBearerToken(normalized)
      setCurrentBearerToken(normalized)
      setBearerFeedback({ kind: 'success', message: 'Bearerトークンを保存しました。' })
      if (activeSection === 'tokens') {
        await loadTokens()
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setBearerFeedback({ kind: 'error', message: 'Bearerトークンが無効です。' })
      } else {
        setBearerFeedback({ kind: 'error', message: formatApiError(error) })
      }
    } finally {
      setBearerSaving(false)
    }
  }, [activeSection, currentBearerToken, loadTokens])

  const handleClearBearerToken = useCallback(() => {
    setStoredBearerToken('')
    setCurrentBearerToken('')
    setCreatedPlainToken('')
    setApiTokens([])
    setTokenAccessDenied(true)
    setTokensError('')
    setBearerFeedback({ kind: 'cleared', message: 'Bearerトークンをクリアしました。' })
  }, [])

  const handleCreateToken = useCallback(async () => {
    const normalizedName = createName.trim()
    if (!normalizedName) {
      setCreateError('端末名を入力してください')
      return
    }

    let expiresAt: string | null = null
    if (createExpiresAt.trim()) {
      const parsed = new Date(createExpiresAt)
      if (Number.isNaN(parsed.getTime())) {
        setCreateError('有効期限は日時として解釈できる値を入力してください')
        return
      }
      expiresAt = parsed.toISOString()
    }

    setCreateLoading(true)
    setCreateError('')
    setCreateFeedback(null)
    try {
      const response = await createApiToken({
        name: normalizedName,
        role: createRole,
        expires_at: expiresAt,
      })
      setCreatedPlainToken(response.plain_token)
      setCreateFeedback({
        kind: 'success',
        message: 'トークンを発行しました。利用する場合は入力欄に貼り付けて保存してください。',
      })
      setCreateName('')
      setCreateRole('device')
      setCreateExpiresAt('')
      await loadTokens()
    } catch (error) {
      setCreateError(formatApiError(error))
    } finally {
      setCreateLoading(false)
    }
  }, [createExpiresAt, createName, createRole, loadTokens])

  const handleCopyCreatedToken = useCallback(async () => {
    if (!createdPlainToken) {
      return
    }
    try {
      const copied = await copyTextToClipboard(createdPlainToken)
      if (!copied) {
        setCreateFeedback({ kind: 'error', message: '平文トークンのコピーに失敗しました。手動でコピーしてください。' })
        return
      }
      setCreateFeedback({ kind: 'success', message: '平文トークンをコピーしました。' })
    } catch {
      setCreateFeedback({ kind: 'error', message: '平文トークンのコピーに失敗しました。手動でコピーしてください。' })
    }
  }, [createdPlainToken])

  const handleRevokeToken = useCallback(
    async (tokenId: string) => {
      setRevokingTokenId(tokenId)
      setTokensError('')
      try {
        await revokeApiToken(tokenId)
        await loadTokens()
      } catch (error) {
        setTokensError(formatApiError(error))
      } finally {
        setRevokingTokenId(null)
      }
    },
    [loadTokens],
  )

  const handleOpenDeleteDialog = useCallback((token: ApiToken) => {
    setDeleteTargetToken(token)
    setTokensError('')
  }, [])

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletingTokenId != null) {
      return
    }
    setDeleteTargetToken(null)
  }, [deletingTokenId])

  const handleDeleteToken = useCallback(async () => {
    if (deleteTargetToken == null) {
      return
    }

    setDeletingTokenId(deleteTargetToken.id)
    setTokensError('')
    try {
      await deleteApiToken(deleteTargetToken.id)
      setDeleteTargetToken(null)
      await loadTokens()
    } catch (error) {
      setTokensError(formatApiError(error))
    } finally {
      setDeletingTokenId(null)
    }
  }, [deleteTargetToken, loadTokens])

  useEffect(() => {
    if (deleteTargetToken == null || typeof document === 'undefined') {
      return
    }

    const originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalBodyOverflow
    }
  }, [deleteTargetToken])

  const panelClassName = `settings-panel ${onClose ? 'settings-panel--dialog' : 'settings-panel--embedded'}`

  return (
    <div className={panelClassName}>
      <div className="settings-dialog__header">
        <div>
          <h3>設定</h3>
          <p>テーマ色・外観・APIトークンを設定できます。</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="settings-dialog__close-btn"
            onClick={onClose}
            aria-label="設定を閉じる"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="settings-dialog__body">
        <aside className="settings-dialog__menu" role="tablist" aria-orientation="vertical" aria-label="設定メニュー">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`settings-dialog__menu-item${activeSection === section.id ? ' settings-dialog__menu-item--active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </aside>

        <section className="settings-dialog__content" role="tabpanel">
          {activeSection === 'theme' ? (
            <div className="settings-dialog__section">
              <h4>テーマ色</h4>
              <div className="settings-theme-grid" role="radiogroup" aria-label="テーマ色選択">
                {themeOptions.map((option) => {
                  const selected = option.id === selectedThemeId
                  const swatchStyle = buildSwatchStyle(option, effectiveAppearanceMode)
                  const isDefault = option.id === 'default'
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`settings-theme-chip${selected ? ' settings-theme-chip--active' : ''}`}
                      onClick={() => onThemeChange(option.id)}
                    >
                      <span
                        className={`settings-theme-chip__swatch${isDefault ? ' settings-theme-chip__swatch--solid' : ''}`}
                        style={swatchStyle}
                        aria-hidden="true"
                      />
                      <span className="settings-theme-chip__label">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : activeSection === 'appearance' ? (
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
          ) : (
            <div className="settings-dialog__section settings-tokens">
              <h4>APIトークン</h4>
              <p className="settings-tokens__description">
                端末別の Bearer トークンを管理します。発行直後の平文トークンは1回だけ表示されます。
              </p>

              <div className="settings-tokens__panel">
                <label className="settings-tokens__label" htmlFor="bearer-token-input">
                  現在利用するBearerトークン
                </label>
                <div className="settings-tokens__inline">
                  <input
                    id="bearer-token-input"
                    className="settings-tokens__input"
                    type="password"
                    placeholder="wol_xxxxx"
                    value={currentBearerToken}
                    onChange={(event) => {
                      setCurrentBearerToken(event.target.value)
                      setBearerFeedback(null)
                    }}
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn--soft" onClick={() => void handleSaveBearerToken()} disabled={bearerSaving}>
                    {bearerSaving ? '確認中...' : '保存'}
                  </button>
                  <button type="button" className="btn btn--soft" onClick={handleClearBearerToken}>
                    クリア
                  </button>
                </div>
                {bearerFeedback ? (
                  <p
                    className={`feedback ${
                      bearerFeedback.kind === 'error'
                        ? 'feedback--error'
                        : bearerFeedback.kind === 'cleared'
                          ? 'feedback--cleared'
                          : 'feedback--success'
                    }`}
                  >
                    {bearerFeedback.message}
                  </p>
                ) : null}
              </div>

              {!tokenAccessDenied ? (
                <>
                  <div className="settings-tokens__panel">
                    <div className="settings-tokens__title-row">
                      <h5>トークン発行</h5>
                      <span className="settings-admin-badge" aria-label="管理者専用">
                        管理者専用
                      </span>
                    </div>
                    <div className="settings-tokens__form">
                      <label className="settings-tokens__label" htmlFor="token-name-input">
                        端末名
                      </label>
                      <input
                        id="token-name-input"
                        className="settings-tokens__input"
                        type="text"
                        placeholder="iphone-FightClub"
                        value={createName}
                        onChange={(event) => {
                          setCreateName(event.target.value)
                          setCreateFeedback(null)
                        }}
                      />
                      <label className="settings-tokens__label" htmlFor="token-role-input">
                        ロール
                      </label>
                      <select
                        id="token-role-input"
                        className="settings-tokens__input"
                        value={createRole}
                        onChange={(event) => {
                          setCreateRole(event.target.value as 'device' | 'admin')
                          setCreateFeedback(null)
                        }}
                      >
                        <option value="device">device（通常端末）</option>
                        <option value="admin">admin（管理用）</option>
                      </select>
                      <label className="settings-tokens__label" htmlFor="token-expire-input">
                        有効期限（任意）
                      </label>
                      <input
                        id="token-expire-input"
                        className="settings-tokens__input"
                        type="datetime-local"
                        value={createExpiresAt}
                        onChange={(event) => {
                          setCreateExpiresAt(event.target.value)
                          setCreateFeedback(null)
                        }}
                      />
                      <p className="settings-tokens__meta">有効期限を未設定にすると、失効するまで無期限で利用できます。</p>
                    </div>
                    <div className="settings-tokens__actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => void handleCreateToken()}
                        disabled={createLoading}
                      >
                        {createLoading ? '発行中...' : 'トークンを発行'}
                      </button>
                    </div>
                    {createError ? <p className="feedback feedback--error">{createError}</p> : null}
                    {createFeedback ? (
                      <p className={`feedback ${createFeedback.kind === 'error' ? 'feedback--error' : 'feedback--success'}`}>
                        {createFeedback.message}
                      </p>
                    ) : null}
                    {createdPlainToken ? (
                      <div className="settings-tokens__created">
                        <div className="settings-tokens__created-head">
                          <p className="settings-tokens__created-label">作成した平文トークン（1回のみ表示）</p>
                          <button
                            type="button"
                            className="settings-tokens__copy-btn"
                            onClick={() => void handleCopyCreatedToken()}
                            aria-label="平文トークンをコピー"
                            title="コピー"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-tokens__copy-icon">
                              <rect x="9" y="9" width="10" height="10" rx="2" />
                              <rect x="5" y="5" width="10" height="10" rx="2" />
                            </svg>
                          </button>
                        </div>
                        <code>{createdPlainToken}</code>
                      </div>
                    ) : null}
                  </div>

                  <div className="settings-tokens__panel settings-tokens__panel--list">
                    <div className="settings-tokens__header">
                      <div className="settings-tokens__title-row">
                        <h5>発行済みトークン</h5>
                        <span className="settings-admin-badge" aria-label="管理者専用">
                          管理者専用
                        </span>
                      </div>
                      <button type="button" className="btn btn--soft" onClick={() => void loadTokens()} disabled={tokensLoading}>
                        再読み込み
                      </button>
                    </div>
                    <p className="settings-tokens__meta">有効トークン: {activeTokenCount} 件</p>
                    {tokensError ? <p className="feedback feedback--error">{tokensError}</p> : null}
                    {tokensLoading ? <p className="settings-tokens__meta">読み込み中...</p> : null}
                    {!tokensLoading && apiTokens.length === 0 ? (
                      <p className="settings-tokens__meta">発行済みトークンはありません。</p>
                    ) : null}
                    <ul className="settings-token-list">
                      {apiTokens.map((token) => {
                        const expired = isExpired(token.expires_at)
                        const revoked = token.revoked_at != null
                        const statusLabel = revoked ? '失効済み' : expired ? '期限切れ' : '有効'
                        return (
                          <li key={token.id} className="settings-token-list__item">
                            <div className="settings-token-list__head">
                              <strong>{token.name}</strong>
                              <div className="settings-token-list__badges">
                                <span className={`settings-token-list__role settings-token-list__role--${token.role}`}>
                                  {token.role.toUpperCase()}
                                </span>
                                <span className={`settings-token-list__status settings-token-list__status--${revoked || expired ? 'inactive' : 'active'}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <p>prefix: {token.token_prefix}</p>
                            <p>最終利用: {token.last_used_at ?? '未使用'}</p>
                            <p>期限: {token.expires_at ?? 'なし'}</p>
                            <div className="settings-token-list__actions">
                              <button
                                type="button"
                                className="btn btn--danger"
                                onClick={() => void handleRevokeToken(token.id)}
                                disabled={revokingTokenId === token.id || revoked}
                              >
                                {revokingTokenId === token.id ? '失効中...' : revoked ? '失効済み' : '失効'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--soft"
                                onClick={() => handleOpenDeleteDialog(token)}
                                disabled={!revoked || revokingTokenId === token.id || deletingTokenId === token.id}
                              >
                                {deletingTokenId === token.id ? '削除中...' : '削除'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {deleteTargetToken
        ? typeof document !== 'undefined'
          ? createPortal(
              <div className="confirm-dialog__backdrop" role="presentation" onClick={handleCloseDeleteDialog}>
                <div
                  className="confirm-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="token-delete-dialog-title"
                  aria-describedby="token-delete-dialog-description"
                  onClick={(event) => event.stopPropagation()}
                >
                  <h3 id="token-delete-dialog-title">トークンを削除しますか？</h3>
                  <p id="token-delete-dialog-description">
                    <strong>{deleteTargetToken.name}</strong>（{deleteTargetToken.token_prefix}）を削除します。この操作は取り消せません。
                  </p>
                  <div className="confirm-dialog__actions">
                    <button type="button" className="btn btn--soft" onClick={handleCloseDeleteDialog} disabled={deletingTokenId != null}>
                      キャンセル
                    </button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleDeleteToken()} disabled={deletingTokenId != null}>
                      {deletingTokenId != null ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null
        : null}
    </div>
  )
}

interface SettingsDialogProps extends SettingsPanelProps {
  open: boolean
  onClose: () => void
}

function SettingsDialog({
  open,
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  onClose,
  onThemeChange,
  onAppearanceChange,
}: SettingsDialogProps) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return
    }

    const scrollY = window.scrollY
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyLeft = document.body.style.left
    const originalBodyRight = document.body.style.right
    const originalBodyWidth = document.body.style.width
    const originalBodyPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalBodyPosition
      document.body.style.top = originalBodyTop
      document.body.style.left = originalBodyLeft
      document.body.style.right = originalBodyRight
      document.body.style.width = originalBodyWidth
      document.body.style.paddingRight = originalBodyPaddingRight
      safeRestoreScrollPosition(scrollY)
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="confirm-dialog__backdrop settings-dialog__backdrop" role="presentation" onClick={onClose}>
      <section
        className="confirm-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        onClick={(event) => event.stopPropagation()}
      >
        <SettingsPanel
          selectedThemeId={selectedThemeId}
          appearanceMode={appearanceMode}
          effectiveAppearanceMode={effectiveAppearanceMode}
          themeOptions={themeOptions}
          onThemeChange={onThemeChange}
          onAppearanceChange={onAppearanceChange}
          onClose={onClose}
        />
      </section>
    </div>
  )
}

export default SettingsDialog

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false
  }
  const timestamp = Date.parse(expiresAt)
  if (Number.isNaN(timestamp)) {
    return false
  }
  return timestamp <= Date.now()
}

function safeRestoreScrollPosition(scrollY: number): void {
  if (typeof window === 'undefined') {
    return
  }
  const userAgent = window.navigator?.userAgent ?? ''
  if (userAgent.toLowerCase().includes('jsdom')) {
    return
  }
  try {
    window.scrollTo(0, scrollY)
  } catch {
    // jsdom may not implement scrollTo
  }
}
