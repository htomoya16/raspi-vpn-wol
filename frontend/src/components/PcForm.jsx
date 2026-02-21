import { useState } from 'react'

const INITIAL_FORM = {
  name: '',
  mac: '',
  ip: '',
  tags: '',
  note: '',
}

function PcForm({ loading, error, onCreate }) {
  const [form, setForm] = useState(INITIAL_FORM)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const tagList = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const payload = {
      name: form.name.trim(),
      mac: form.mac.trim(),
      ip: form.ip.trim() || null,
      tags: tagList,
      note: form.note.trim() || null,
    }

    const created = await onCreate(payload)
    if (created) {
      setForm(INITIAL_FORM)
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>PC登録</h2>
        <p>必要な項目だけ入力すれば登録できます。IDはサーバー側で自動採番されます。</p>
      </div>

      <form className="pc-form" onSubmit={handleSubmit}>
        <label>
          表示名
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Main PC"
            required
          />
        </label>

        <label>
          MACアドレス
          <input
            type="text"
            value={form.mac}
            onChange={(event) => updateField('mac', event.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            required
          />
        </label>

        <label>
          IPアドレス（任意）
          <input
            type="text"
            value={form.ip}
            onChange={(event) => updateField('ip', event.target.value)}
            placeholder="192.168.10.20"
          />
        </label>

        <label>
          タグ（カンマ区切り）
          <input
            type="text"
            value={form.tags}
            onChange={(event) => updateField('tags', event.target.value)}
            placeholder="work, windows"
          />
        </label>

        <label>
          メモ（任意）
          <textarea
            value={form.note}
            onChange={(event) => updateField('note', event.target.value)}
            placeholder="普段は有線LAN、WOL確認済み"
            rows={3}
          />
        </label>

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? '登録中...' : 'PCを登録'}
        </button>
      </form>

      {error ? <p className="feedback feedback--error">{error}</p> : null}
    </section>
  )
}

export default PcForm
