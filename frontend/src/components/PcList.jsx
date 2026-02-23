import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '../hooks/useMediaQuery'

const STATUS_LABELS = {
  online: 'オンライン',
  offline: 'オフライン',
  unknown: '不明',
  booting: '起動中',
  unreachable: '到達不能',
}

const EMPTY_EDIT_FORM = {
  name: '',
  mac: '',
  ip: '',
  tags: '',
  note: '',
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

function formatJstDateTime(value) {
  if (!value) {
    return '未同期'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  })
}

function toEditForm(pc) {
  if (!pc) {
    return EMPTY_EDIT_FORM
  }

  return {
    name: pc.name || '',
    mac: pc.mac || '',
    ip: pc.ip || '',
    tags: (pc.tags || []).join(', '),
    note: pc.note || '',
  }
}

function parseTags(text) {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function PcList({
  items,
  loading,
  error,
  filters,
  appliedFilters,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onReload,
  onRefreshStatus,
  onSendWol,
  onDelete,
  onUpdate,
  busyById,
  rowErrorById,
  lastSyncedAt,
  embedded = false,
}) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPcId, setSelectedPcId] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)

  const selectedPc = useMemo(
    () => items.find((pc) => pc.id === selectedPcId) || null,
    [items, selectedPcId],
  )
  const activeFilters = appliedFilters || filters
  const hasActiveFilter = Boolean((activeFilters.q || '').trim() || activeFilters.status)

  useEffect(() => {
    setShowFilters(!isMobile)
  }, [isMobile])

  useEffect(() => {
    if (items.length === 0) {
      setSelectedPcId('')
      setDetailOpen(false)
      setIsEditing(false)
      return
    }

    if (!selectedPcId) {
      return
    }

    const exists = items.some((pc) => pc.id === selectedPcId)
    if (!exists) {
      setSelectedPcId('')
      setDetailOpen(false)
      setIsEditing(false)
    }
  }, [items, selectedPcId])

  useEffect(() => {
    if (!selectedPc || isEditing) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
  }, [isEditing, selectedPc])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const lockScroll = detailOpen || Boolean(pendingDelete)
    if (!lockScroll) {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [detailOpen, pendingDelete])

  function openDetail(pcId) {
    if (confirmLoading || editLoading) {
      return
    }
    setSelectedPcId(pcId)
    setDetailOpen(true)
    setIsEditing(false)
    setEditError('')
  }

  function closeDetail() {
    if (confirmLoading || editLoading) {
      return
    }
    setDetailOpen(false)
    setIsEditing(false)
    setEditError('')
  }

  function openDeleteDialog(pcId, pcName) {
    setPendingDelete({ id: pcId, name: pcName })
  }

  function closeDeleteDialog() {
    if (confirmLoading) {
      return
    }
    setPendingDelete(null)
  }

  async function confirmAndDelete() {
    if (!pendingDelete || confirmLoading) {
      return
    }

    setConfirmLoading(true)
    try {
      await onDelete(pendingDelete.id)
      if (selectedPcId === pendingDelete.id) {
        setSelectedPcId('')
        setDetailOpen(false)
        setIsEditing(false)
      }
      setPendingDelete(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  function startEdit() {
    if (!selectedPc) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(true)
  }

  function cancelEdit() {
    if (editLoading) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(false)
  }

  function updateEditField(key, value) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submitEdit(event) {
    event.preventDefault()
    if (!selectedPc || editLoading) {
      return
    }

    const name = editForm.name.trim()
    const mac = editForm.mac.trim()
    if (!name || !mac) {
      setEditError('表示名とMACアドレスは必須です。')
      return
    }

    const payload = {
      name,
      mac,
      ip: editForm.ip.trim() || null,
      tags: parseTags(editForm.tags),
      note: editForm.note.trim() || null,
    }

    setEditLoading(true)
    setEditError('')
    try {
      await onUpdate(selectedPc.id, payload)
      setIsEditing(false)
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'PC更新に失敗しました。'
      setEditError(message)
    } finally {
      setEditLoading(false)
    }
  }

  const content = (
    <>
      <div className="panel__header pc-list__header">
        <div>
          <h2>PC一覧</h2>
          <p>PCを選択すると詳細を開き、編集・削除できます。</p>
        </div>
        <p className="pc-list__sync">最終更新: {formatJstDateTime(lastSyncedAt)}</p>
      </div>

      <div className="pc-filters-shell">
        {isMobile ? (
          <button
            type="button"
            className="btn btn--soft pc-filters-toggle"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
          >
            {showFilters ? '絞り込みを非表示' : '絞り込みを表示'}
          </button>
        ) : null}

        {!isMobile || showFilters ? (
          <div className="pc-filters">
            <label>
              検索
              <input
                type="text"
                value={filters.q}
                onChange={(event) => onFilterChange('q', event.target.value)}
                placeholder="名前 / ID / MAC"
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
              {loading ? '読み込み中...' : '再読み込み'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      {loading ? (
        <p className="empty-state">PC一覧を読み込んでいます...</p>
      ) : items.length === 0 ? (
        <p className="empty-state">{hasActiveFilter ? '該当するPCがありません。' : 'PCがまだ登録されていません。'}</p>
      ) : (
        <>
          <ul className="pc-row-list">
            {items.map((pc) => {
              const isBusy = busyById[pc.id] || {}
              const statusLabel = STATUS_LABELS[pc.status] || pc.status
              const isActive = detailOpen && pc.id === selectedPcId

              return (
                <li key={pc.id} className={`pc-row ${isActive ? 'pc-row--active' : ''}`}>
                  <div
                    className="pc-row__summary"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(pc.id)}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target) {
                        return
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDetail(pc.id)
                      }
                    }}
                    aria-pressed={isActive}
                  >
                    <div className="pc-row__summary-main">
                      <p className="pc-row__name">{pc.name}</p>
                      <p className="pc-row__id">{pc.id}</p>
                    </div>
                    <div className="pc-row__summary-meta">
                      <span className={`status-badge status-badge--${pc.status}`}>{statusLabel}</span>
                      <p className="pc-row__last-seen">最終確認: {formatDateTime(pc.last_seen_at)}</p>
                    </div>
                    <div className="pc-row__list-actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSendWol(pc.id)
                        }}
                        disabled={Boolean(isBusy.wol)}
                      >
                        {isBusy.wol ? '起動中...' : '起動'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--soft"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRefreshStatus(pc.id)
                        }}
                        disabled={Boolean(isBusy.status)}
                      >
                        {isBusy.status ? '状態確認中...' : '状態確認'}
                      </button>
                    </div>
                  </div>

                  {rowErrorById[pc.id] ? (
                    <p className="feedback feedback--error">{rowErrorById[pc.id]}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )

  const portalTarget = typeof document !== 'undefined' ? document.body : null

  const detailDialog = detailOpen && selectedPc ? (
    <div className="pc-detail-dialog__backdrop" role="presentation" onClick={closeDetail}>
      <section
        className="pc-detail pc-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pc-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pc-detail__header">
          <div>
            <h3 id="pc-detail-title">{selectedPc.name}</h3>
            <p>{selectedPc.id}</p>
          </div>
          <div className="pc-detail__header-side">
            <span className={`status-badge status-badge--${selectedPc.status}`}>
              {STATUS_LABELS[selectedPc.status] || selectedPc.status}
            </span>
            <button type="button" className="btn btn--soft" onClick={closeDetail} disabled={editLoading}>
              閉じる
            </button>
          </div>
        </div>

        {isEditing ? (
          <form className="pc-edit-form" onSubmit={submitEdit}>
            <label>
              表示名
              <input
                type="text"
                value={editForm.name}
                onChange={(event) => updateEditField('name', event.target.value)}
                required
              />
            </label>

            <label>
              MACアドレス
              <input
                type="text"
                value={editForm.mac}
                onChange={(event) => updateEditField('mac', event.target.value)}
                required
              />
            </label>

            <label>
              IPアドレス（任意）
              <input
                type="text"
                value={editForm.ip}
                onChange={(event) => updateEditField('ip', event.target.value)}
              />
            </label>

            <label>
              タグ（カンマ区切り・任意）
              <input
                type="text"
                value={editForm.tags}
                onChange={(event) => updateEditField('tags', event.target.value)}
              />
            </label>

            <label>
              メモ（任意）
              <textarea
                rows={3}
                value={editForm.note}
                onChange={(event) => updateEditField('note', event.target.value)}
              />
            </label>

            {editError ? <p className="feedback feedback--error">{editError}</p> : null}

            <div className="pc-detail__actions">
              <button type="submit" className="btn btn--primary" disabled={editLoading}>
                {editLoading ? '保存中...' : '保存'}
              </button>
              <button type="button" className="btn btn--soft" onClick={cancelEdit} disabled={editLoading}>
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="pc-detail__grid">
              <div className="pc-detail__item">
                <dt>MAC</dt>
                <dd className="pc-row__cell pc-row__cell--mono">{selectedPc.mac}</dd>
              </div>
              <div className="pc-detail__item">
                <dt>IP</dt>
                <dd className="pc-row__cell">{selectedPc.ip || '未設定'}</dd>
              </div>
              <div className="pc-detail__item">
                <dt>最終確認</dt>
                <dd className="pc-row__cell">{formatDateTime(selectedPc.last_seen_at)}</dd>
              </div>
              <div className="pc-detail__item">
                <dt>タグ</dt>
                <dd className="pc-row__cell">
                  {(selectedPc.tags || []).length > 0 ? selectedPc.tags.join(', ') : '未設定'}
                </dd>
              </div>
              <div className="pc-detail__item">
                <dt>メモ</dt>
                <dd className="pc-row__cell">{selectedPc.note || '未設定'}</dd>
              </div>
            </dl>

            <div className="pc-detail__actions">
              <button type="button" className="btn btn--soft" onClick={startEdit}>
                編集
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => openDeleteDialog(selectedPc.id, selectedPc.name)}
                disabled={Boolean(busyById[selectedPc.id]?.delete)}
              >
                {busyById[selectedPc.id]?.delete ? '削除中...' : '削除'}
              </button>
            </div>
          </>
        )}

        {rowErrorById[selectedPc.id] ? (
          <p className="feedback feedback--error">{rowErrorById[selectedPc.id]}</p>
        ) : null}
      </section>
    </div>
  ) : null

  const deleteDialog = pendingDelete ? (
    <div className="confirm-dialog__backdrop" role="presentation" onClick={closeDeleteDialog}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="delete-dialog-title">PCを削除しますか？</h3>
        <p id="delete-dialog-description">
          PC「{pendingDelete.name}」（{pendingDelete.id}）を削除します。この操作は取り消せません。
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--soft" onClick={closeDeleteDialog} disabled={confirmLoading}>
            キャンセル
          </button>
          <button type="button" className="btn btn--danger" onClick={confirmAndDelete} disabled={confirmLoading}>
            {confirmLoading ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {embedded ? <div className="panel-embedded">{content}</div> : <section className="panel">{content}</section>}
      {portalTarget && detailDialog ? createPortal(detailDialog, portalTarget) : null}
      {portalTarget && deleteDialog ? createPortal(deleteDialog, portalTarget) : null}
    </>
  )
}

export default PcList
