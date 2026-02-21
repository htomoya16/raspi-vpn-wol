function LogsPanel({
  items,
  loading,
  error,
  limit,
  onLimitChange,
  onReload,
}) {
  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }

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
      <p>最新 {limit} 件を表示</p>

      {items.length === 0 ? (
        <p>ログがありません</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>時刻</th>
              <th>Action</th>
              <th>Target</th>
              <th>Result</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{formatDateTime(item.created_at)}</td>
                <td>{item.action}</td>
                <td>{item.target}</td>
                <td>{item.status}</td>
                <td>{item.message ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default LogsPanel;
