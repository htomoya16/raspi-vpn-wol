function AppHeader({
  healthStatus,
  healthError,
  healthLoading,
  totalCount,
  onlineCount,
  lastSyncedAt,
  refreshAllLoading,
  onCheckHealth,
  onRefreshAllStatuses,
}) {
  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString()
    : '未同期'

  const healthLabel = healthError || healthStatus || 'unknown'

  return (
    <header className="hero panel">
      <div className="hero__lead">
        <p className="hero__eyebrow">VPN LAN POWER DASHBOARD</p>
        <h1>WOL Control Center</h1>
        <p className="hero__description">
          VPN内からPCを安全に起動し、状態確認と操作ログをまとめて管理します。
        </p>
      </div>

      <div className="hero__metrics">
        <article>
          <h2>API</h2>
          <p>{healthLabel}</p>
        </article>
        <article>
          <h2>登録PC</h2>
          <p>{totalCount}</p>
        </article>
        <article>
          <h2>Online</h2>
          <p>{onlineCount}</p>
        </article>
        <article>
          <h2>最終同期</h2>
          <p>{lastSyncedLabel}</p>
        </article>
      </div>

      <div className="hero__actions">
        <button type="button" className="btn btn--soft" onClick={onCheckHealth} disabled={healthLoading}>
          {healthLoading ? 'Health確認中...' : 'Health再確認'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onRefreshAllStatuses}
          disabled={refreshAllLoading}
        >
          {refreshAllLoading ? '更新ジョブ投入中...' : '全PCステータス更新'}
        </button>
      </div>
    </header>
  )
}

export default AppHeader
