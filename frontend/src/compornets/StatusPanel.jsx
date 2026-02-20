function StatusPanel({ status, onCheck }) {
  return (
    <section>
      <h2>接続チェック（学習用）</h2>
      <p>状態: {status}</p>
      <button onClick={onCheck}>接続確認（仮）</button>
    </section>
  );
}

export default StatusPanel;
