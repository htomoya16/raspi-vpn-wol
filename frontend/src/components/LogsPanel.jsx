import { useState } from 'react'

function parseDate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const raw = String(value).trim()
  // SQLiteのタイムゾーンなし時刻は UTC として先に解釈する
  const naive = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/)
  if (naive) {
    const utc = new Date(`${naive[1]}T${naive[2]}Z`)
    if (!Number.isNaN(utc.getTime())) {
      return utc
    }
  }

  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }

  return null
}

function formatDateTime(value) {
  const date = parseDate(value)
  if (!date) {
    return value
  }
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  })
}

function formatDetails(details) {
  if (!details || typeof details !== 'object') {
    return '-'
  }
  return JSON.stringify(details)
}

function LogsPanel({ items, loading, error, onReload, onClear, embedded = false }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  function openConfirm() {
    setConfirmOpen(true)
  }

  function closeConfirm() {
    if (clearLoading) {
      return
    }
    setConfirmOpen(false)
  }

  async function confirmClear() {
    if (clearLoading) {
      return
    }
    setClearLoading(true)
    try {
      await onClear()
      setConfirmOpen(false)
    } catch {
      // noop: エラー表示は親コンポーネント経由で描画される
    } finally {
      setClearLoading(false)
    }
  }

  const content = (
    <>
      <div className="panel__header">
        <h2>操作ログ</h2>
        <p>最新ログを1シートで確認できます。</p>
      </div>

      <div className="logs-toolbar">
        <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading || clearLoading}>
          {loading ? '読み込み中...' : '再読込'}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={openConfirm}
          disabled={items.length === 0 || loading || clearLoading}
        >
          ログ消去
        </button>
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="empty-state">ログがありません。</p>
      ) : (
        <div className="logs-sheet">
          <table className="logs-table">
            <thead>
              <tr>
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
    </>
  )

  return (
    <>
      {embedded ? <div className="panel-embedded panel-embedded--logs">{content}</div> : <section className="panel">{content}</section>}

      {confirmOpen ? (
        <div className="confirm-dialog__backdrop" role="presentation" onClick={closeConfirm}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-clear-dialog-title"
            aria-describedby="log-clear-dialog-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="log-clear-dialog-title">ログを消去しますか？</h3>
            <p id="log-clear-dialog-description">
              現在表示されている操作ログを全件削除します。この操作は取り消せません。
            </p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn btn--soft" onClick={closeConfirm} disabled={clearLoading}>
                キャンセル
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmClear} disabled={clearLoading}>
                {clearLoading ? '消去中...' : '消去する'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default LogsPanel
