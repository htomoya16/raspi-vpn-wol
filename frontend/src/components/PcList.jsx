const STATUS_LABELS = {
  online: 'オンライン',
  offline: 'オフライン',
  unknown: '不明',
  booting: '起動中',
  unreachable: '到達不能',
}

function formatDateTime(value) {
  if (!value) {
    return '未記録'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function PcList({
  items,
  loading,
  error,
  filters,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onReload,
  onRefreshStatus,
  onSendWol,
  onDelete,
  busyById,
  rowErrorById,
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>PC一覧</h2>
        <p>ステータス確認・WOL送信・削除をここから実行できます。</p>
      </div>

      <div className="pc-filters">
        <label>
          検索
          <input
            type="text"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
            placeholder="name / id / mac"
          />
        </label>

        <label>
          ステータス
          <select
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
          >
            <option value="">すべて</option>
            <option value="online">online</option>
            <option value="offline">offline</option>
            <option value="unknown">unknown</option>
            <option value="booting">booting</option>
            <option value="unreachable">unreachable</option>
          </select>
        </label>

        <button type="button" className="btn btn--primary" onClick={onApplyFilters}>
          適用
        </button>
        <button type="button" className="btn btn--soft" onClick={onClearFilters}>
          クリア
        </button>
        <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading}>
          {loading ? '読み込み中...' : '再読込'}
        </button>
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      {loading ? (
        <p className="empty-state">PC一覧を読み込み中です...</p>
      ) : items.length === 0 ? (
        <p className="empty-state">PCがまだ登録されていません。</p>
      ) : (
        <ul className="pc-grid">
          {items.map((pc) => {
            const isBusy = busyById[pc.id] || {}
            const statusLabel = STATUS_LABELS[pc.status] || pc.status

            return (
              <li key={pc.id} className="pc-card">
                <div className="pc-card__head">
                  <div>
                    <h3>{pc.name}</h3>
                    <p className="pc-id">{pc.id}</p>
                  </div>
                  <span className={`status-badge status-badge--${pc.status}`}>{statusLabel}</span>
                </div>

                <dl className="pc-meta">
                  <div>
                    <dt>MAC</dt>
                    <dd>{pc.mac}</dd>
                  </div>
                  <div>
                    <dt>IP</dt>
                    <dd>{pc.ip || '未設定'}</dd>
                  </div>
                  <div>
                    <dt>最終到達</dt>
                    <dd>{formatDateTime(pc.last_seen_at)}</dd>
                  </div>
                </dl>

                {(pc.tags || []).length > 0 ? (
                  <div className="tag-row">
                    {(pc.tags || []).map((tag) => (
                      <span key={`${pc.id}-${tag}`} className="tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {pc.note ? <p className="pc-note">{pc.note}</p> : null}

                <div className="pc-card__actions">
                  <button
                    type="button"
                    className="btn btn--soft"
                    onClick={() => onRefreshStatus(pc.id)}
                    disabled={Boolean(isBusy.status)}
                  >
                    {isBusy.status ? '確認中...' : '状態確認'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => onSendWol(pc.id)}
                    disabled={Boolean(isBusy.wol)}
                  >
                    {isBusy.wol ? '送信中...' : 'WOL送信'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => onDelete(pc.id)}
                    disabled={Boolean(isBusy.delete)}
                  >
                    {isBusy.delete ? '削除中...' : '削除'}
                  </button>
                </div>

                {rowErrorById[pc.id] ? (
                  <p className="feedback feedback--error">{rowErrorById[pc.id]}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default PcList
