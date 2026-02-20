function TargetsList({ items, loading, error, onReload, wolLoadingId, onWake, wolError }) {
  return (
    <section>
      <h2>Targets</h2>
      <button onClick={onReload} disabled={loading}>
        {loading ? '読み込み中...' : '再読み込み'}
      </button>

      {error ? <p style={{ color: 'red' }}>error: {error}</p> : null}
      {wolError ? <p style={{ color: 'red' }}>error: {wolError}</p> : null}

      {items.length === 0 ? (
        <p>ターゲットがありません</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id}>
              {t.name} ({t.id}) - {t.mac_address}
              <button onClick={() => onWake(t.id)} disabled={wolLoadingId !== null}>
                {wolLoadingId ? `WOL送信中... (ID: ${wolLoadingId})` : 'WOL送信'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default TargetsList;
