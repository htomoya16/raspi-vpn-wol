function TargetsList({
  items,
  loading,
  error,
  onReload,
  wolLoadingId,
  onWake,
  wolError,
  statusById,
  statusLoadingId,
  onCheckStatus,
  statusError,
}) {
  return (
    <section>
      <h2>Targets</h2>
      <button onClick={onReload} disabled={loading}>
        {loading ? '読み込み中...' : '再読み込み'}
      </button>

      {error ? <p style={{ color: 'red' }}>error: {error}</p> : null}
      {wolError ? <p style={{ color: 'red' }}>error: {wolError}</p> : null}
      {statusError ? <p style={{ color: 'red' }}>error: {statusError}</p> : null}

      {items.length === 0 ? (
        <p>ターゲットがありません</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id}>
              {t.name} ({t.id}) - {t.mac_address} - Status: {statusById[t.id] ?? '未確認'}
              <button onClick={() => onCheckStatus(t.id)} disabled={statusLoadingId !== null}>
                {statusLoadingId === t.id ? '状態確認中...' : '状態確認'}
              </button>
              <button onClick={() => onWake(t.id)} disabled={wolLoadingId !== null}>
                {wolLoadingId === t.id ? 'WOL送信中...' : 'WOL送信'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default TargetsList;
