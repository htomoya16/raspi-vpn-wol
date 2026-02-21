function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatDetails(details) {
  if (!details || typeof details !== 'object') {
    return '-'
  }
  return JSON.stringify(details)
}

function LogsPanel({ items, loading, error, limit, onLimitChange, onReload }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>操作ログ</h2>
        <p>監査向けに最新ログを表示します。</p>
      </div>

      <div className="logs-toolbar">
        <label>
          表示件数
          <select value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>

        <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading}>
          {loading ? '読み込み中...' : '再読込'}
        </button>
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="empty-state">ログがありません。</p>
      ) : (
        <div className="logs-table-wrap">
          <table className="logs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>時刻</th>
                <th>Action</th>
                <th>PC</th>
                <th>結果</th>
                <th>Message</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label="ID">{item.id}</td>
                  <td data-label="時刻">{formatDateTime(item.created_at)}</td>
                  <td data-label="Action">{item.action}</td>
                  <td data-label="PC">{item.pc_id || '-'}</td>
                  <td data-label="結果">
                    <span className={item.ok ? 'result-ok' : 'result-ng'}>{item.ok ? 'OK' : 'NG'}</span>
                  </td>
                  <td data-label="Message">{item.message || '-'}</td>
                  <td data-label="Details">{formatDetails(item.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default LogsPanel
