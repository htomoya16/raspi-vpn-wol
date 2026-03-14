import LoadingDots from './LoadingDots'
import settingsIcon from './icons/setting.svg'

interface AppHeaderProps {
  totalCount: number
  onlineCount: number
  refreshAllLoading: boolean
  tokenConfigured: boolean
  activeTokenName: string
  activeTokenRole: 'admin' | 'device' | null
  buildLabel: string | null
  onRefreshAllStatuses: () => Promise<void> | void
  onOpenSettings: () => void
}

function AppHeader({
  totalCount,
  onlineCount,
  refreshAllLoading,
  tokenConfigured,
  activeTokenName,
  activeTokenRole,
  buildLabel,
  onRefreshAllStatuses,
  onOpenSettings,
}: AppHeaderProps) {
  const refreshDisabled = refreshAllLoading || !tokenConfigured
  return (
    <header className="hero hero--compact">
      <div className="hero__lead">
        <div className="hero__eyebrow-row">
          <p className="hero__eyebrow">VPN LAN POWER DASHBOARD</p>
          {buildLabel ? <span className="hero__build">{buildLabel}</span> : null}
        </div>
        <h1>WOL Control Center</h1>
        <p className="hero__description">
          VPN内からPCを安全に起動し、ステータス確認と操作ログをまとめて管理します。
        </p>
        {tokenConfigured ? (
          <p className="hero__actor">
            現在の端末: <strong>{activeTokenName || '取得中...'}</strong>
            {activeTokenRole ? (
              <span className={`hero__actor-role hero__actor-role--${activeTokenRole}`}>
                {activeTokenRole.toUpperCase()}
              </span>
            ) : null}
          </p>
        ) : null}
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
          disabled={refreshDisabled}
        >
          {refreshAllLoading ? (
            <LoadingDots label="更新ジョブ投入中" />
          ) : tokenConfigured ? (
            '全PCステータス更新'
          ) : (
            'APIトークン未認証'
          )}
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
