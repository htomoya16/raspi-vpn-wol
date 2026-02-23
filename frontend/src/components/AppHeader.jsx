function AppHeader({
  totalCount,
  onlineCount,
  refreshAllLoading,
  onRefreshAllStatuses,
}) {
  return (
    <header className="hero hero--compact">
      <div className="hero__lead">
        <p className="hero__eyebrow">VPN LAN POWER DASHBOARD</p>
        <h1>WOL Control Center</h1>
        <p className="hero__description">
          VPN内からPCを安全に起動し、状態確認と操作ログをまとめて管理します。
        </p>
      </div>

      <div className="hero__metrics">
        <article>
          <h2>登録PC</h2>
          <p>{totalCount}</p>
        </article>
        <article>
          <h2>Online</h2>
          <p>{onlineCount}</p>
        </article>
      </div>

      <div className="hero__actions">
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
