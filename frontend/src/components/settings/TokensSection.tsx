import { useCallback } from 'react'

import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { isExpired, type UseAdminTokensResult } from '../../hooks/useAdminTokens'
import TokenDeleteDialog from './TokenDeleteDialog'

interface TokensSectionProps {
  tokens: UseAdminTokensResult
}

function TokensSection({ tokens }: TokensSectionProps) {
  const {
    apiTokens,
    tokensLoading,
    tokensError,
    tokenAccessDenied,
    currentBearerToken,
    bearerSaving,
    bearerFeedback,
    createName,
    createRole,
    createExpiresAt,
    createLoading,
    createError,
    createFeedback,
    createdPlainToken,
    revokingTokenId,
    deletingTokenId,
    deleteTargetToken,
    activeTokenCount,
    setCurrentBearerToken,
    setCreateName,
    setCreateRole,
    setCreateExpiresAt,
    clearBearerFeedback,
    clearCreateFeedback,
    setCreateFeedback,
    loadTokens,
    handleSaveBearerToken,
    handleClearBearerToken,
    handleCreateToken,
    handleCopyCreatedToken,
    handleRevokeToken,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteToken,
  } = tokens

  useBodyScrollLock(deleteTargetToken != null, { strategy: 'overflow' })

  const onCopyCreatedToken = useCallback(async () => {
    const result = await handleCopyCreatedToken()
    setCreateFeedback({ kind: result.ok ? 'success' : 'error', message: result.message })
  }, [handleCopyCreatedToken, setCreateFeedback])

  return (
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
              clearBearerFeedback()
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
                  clearCreateFeedback()
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
                  clearCreateFeedback()
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
                  clearCreateFeedback()
                }}
              />
              <p className="settings-tokens__meta">有効期限を未設定にすると、失効するまで無期限で利用できます。</p>
            </div>
            <div className="settings-tokens__actions">
              <button type="button" className="btn btn--primary" onClick={() => void handleCreateToken()} disabled={createLoading}>
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
                    onClick={() => void onCopyCreatedToken()}
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
            {!tokensLoading && apiTokens.length === 0 ? <p className="settings-tokens__meta">発行済みトークンはありません。</p> : null}
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
                        <span className={`settings-token-list__role settings-token-list__role--${token.role}`}>{token.role.toUpperCase()}</span>
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

      <TokenDeleteDialog
        target={deleteTargetToken}
        deleting={deletingTokenId != null}
        onClose={handleCloseDeleteDialog}
        onConfirm={() => void handleDeleteToken()}
      />
    </div>
  )
}

export default TokensSection
