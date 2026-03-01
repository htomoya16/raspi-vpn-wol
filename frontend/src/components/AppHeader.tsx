import LoadingDots from './LoadingDots'
import settingsIcon from './icons/setting.svg'

interface AppHeaderProps {
  totalCount: number
  onlineCount: number
  refreshAllLoading: boolean
  onRefreshAllStatuses: () => Promise<void> | void
  onOpenSettings: () => void
}

function AppHeader({
  totalCount,
  onlineCount,
  refreshAllLoading,
  onRefreshAllStatuses,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header className="hero hero--compact">
      <div className="hero__lead">
        <p className="hero__eyebrow">VPN LAN POWER DASHBOARD</p>
        <h1>WOL Control Center</h1>
        <p className="hero__description">
          VPN内からPCを安全に起動し、ステータス確認と操作ログをまとめて管理します。
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
          {refreshAllLoading ? <LoadingDots label="更新ジョブ投入中" /> : '全PCステータス更新'}
        </button>
        <button
          type="button"
          className="hero__settings-btn"
          onClick={onOpenSettings}
          aria-label="設定を開く"
          title="設定"
        >
          <img src={settingsIcon} alt="" aria-hidden="true" className="hero__settings-icon" />
        </button>
      </div>
    </header>
  )
}

export default AppHeader
