import { useState, type FormEvent } from 'react'

import LoadingDots from './LoadingDots'
import type { PcCreatePayload } from '../types/models'

const INITIAL_FORM = {
  name: '',
  mac: '',
  ip: '',
  tags: '',
  note: '',
}

export interface PcFormProps {
  loading: boolean
  error: string
  onCreate: (payload: PcCreatePayload) => Promise<boolean>
  embedded?: boolean
}

function PcForm({ loading, error, onCreate, embedded = false }: PcFormProps) {
  const [form, setForm] = useState(INITIAL_FORM)

  function updateField(key: keyof typeof INITIAL_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const tagList = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const payload: PcCreatePayload = {
      name: form.name.trim(),
      mac: form.mac.trim(),
      ip: form.ip.trim(),
      tags: tagList,
      note: form.note.trim() || null,
    }

    const created = await onCreate(payload)
    if (created) {
      setForm(INITIAL_FORM)
    }
  }

  const content = (
    <>
      <div className="panel__header">
        <h2>PC登録</h2>
        <p>表示名・MACアドレス・IPアドレスは必須です。</p>
      </div>

      <form className="pc-form" onSubmit={handleSubmit}>
        <label>
          表示名（必須）
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Main PC"
            required
          />
        </label>

        <label>
          MACアドレス（必須）
          <input
            type="text"
            value={form.mac}
            onChange={(event) => updateField('mac', event.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            required
          />
        </label>

        <label>
          IPアドレス（必須）
          <input
            type="text"
            value={form.ip}
            onChange={(event) => updateField('ip', event.target.value)}
            placeholder="192.168.10.20"
            required
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
          {loading ? <LoadingDots label="登録中" /> : 'PCを登録'}
        </button>
      </form>

      {error ? <p className="feedback feedback--error">{error}</p> : null}
    </>
  )

  if (embedded) {
    return <div className="panel-embedded">{content}</div>
  }

  return <section className="panel">{content}</section>
}

export default PcForm
