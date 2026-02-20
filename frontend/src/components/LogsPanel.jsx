function LogsPanel({
  items,
  loading,
  error,
  limit,
  onLimitChange,
  onReload,
}) {
  return (
    <section>
      <h2>Logs</h2>
      <label htmlFor="logs-limit">表示件数: </label>
      <select
        id="logs-limit"
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        disabled={loading}
      >
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <button onClick={onReload} disabled={loading}>
        {loading ? '読み込み中...' : '再読み込み'}
      </button>

      {error ? <p style={{ color: 'red' }}>error: {error}</p> : null}

      {items.length === 0 ? (
        <p>ログがありません</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              #{item.id} [{item.action}] {item.target} - {item.status} - {item.created_at}
              {item.message ? ` / ${item.message}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LogsPanel;
