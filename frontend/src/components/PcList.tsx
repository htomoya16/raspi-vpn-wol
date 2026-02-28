import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '../hooks/useMediaQuery'
import { useDelayedVisibility } from '../hooks/useDelayedVisibility'
import type { BusyById, Pc, PcBusyState, PcFilterState, PcUpdatePayload, RowErrorById } from '../types/models'
import { formatJstDateTime } from '../utils/datetime'
import LoadingSpinner from './LoadingSpinner'
import PcDeleteDialog from './pc-list/PcDeleteDialog'
import type { PendingDeleteState } from './pc-list/PcDeleteDialog'
import PcDetailDialog from './pc-list/PcDetailDialog'
import PcRowItem from './pc-list/PcRowItem'
import { EMPTY_EDIT_FORM, STATUS_LABELS, type PcEditFormState } from './pc-list/constants'
import { toEditForm, toUpdatePayload } from './pc-list/utils'
import LoadingDots from './LoadingDots'

export interface PcListProps {
  items: Pc[]
  loading: boolean
  error: string
  filters: PcFilterState
  appliedFilters: PcFilterState
  onFilterChange: (key: keyof PcFilterState, value: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onReload: () => Promise<void> | void
  onRefreshStatus: (pcId: string) => Promise<void> | void
  onSendWol: (pcId: string) => Promise<void> | void
  onDelete: (pcId: string) => Promise<void>
  onUpdate: (pcId: string, payload: PcUpdatePayload) => Promise<Pc>
  onSelectPc?: (pcId: string) => void
  busyById: BusyById
  rowErrorById: RowErrorById
  lastSyncedAt: string
  embedded?: boolean
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
  onSelectPc,
  busyById,
  rowErrorById,
  lastSyncedAt,
  embedded = false,
}: PcListProps) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPcId, setSelectedPcId] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editForm, setEditForm] = useState<PcEditFormState>(EMPTY_EDIT_FORM)

  const selectedPc = useMemo<Pc | null>(
    () => items.find((pc) => pc.id === selectedPcId) || null,
    [items, selectedPcId],
  )

  const activeFilters = appliedFilters || filters
  const hasActiveFilter = Boolean((activeFilters.q || '').trim() || activeFilters.status)
  const hasItems = items.length > 0
  const showInitialLoading = loading && !hasItems
  const showRefreshingSpinner = useDelayedVisibility(loading && hasItems, 200)

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

  function openDetail(pcId: string): void {
    if (confirmLoading || editLoading) {
      return
    }
    setSelectedPcId(pcId)
    onSelectPc?.(pcId)
    setDetailOpen(true)
    setIsEditing(false)
    setEditError('')
  }

  function closeDetail(): void {
    if (confirmLoading || editLoading) {
      return
    }
    setDetailOpen(false)
    setIsEditing(false)
    setEditError('')
  }

  function openDeleteDialog(pcId: string, pcName: string): void {
    setPendingDelete({ id: pcId, name: pcName })
  }

  function closeDeleteDialog(): void {
    if (confirmLoading) {
      return
    }
    setPendingDelete(null)
  }

  async function confirmAndDelete(): Promise<void> {
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

  function startEdit(): void {
    if (!selectedPc) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(true)
  }

  function cancelEdit(): void {
    if (editLoading) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(false)
  }

  function updateEditField(key: keyof PcEditFormState, value: string): void {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedPc || editLoading) {
      return
    }

    const name = editForm.name.trim()
    const mac = editForm.mac.trim()
    const ip = editForm.ip.trim()
    if (!name || !mac || !ip) {
      setEditError('表示名・MACアドレス・IPアドレスは必須です。')
      return
    }

    const payload = toUpdatePayload({
      ...editForm,
      name,
      mac,
      ip,
    })

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
        <p className="pc-list__sync">
          最終更新: {formatJstDateTime(lastSyncedAt, { fallback: '未同期' })}
        </p>
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
              {showInitialLoading ? (
                <LoadingDots label="読み込み中" />
              ) : (
                <span className="btn__with-spinner">
                  {showRefreshingSpinner ? <LoadingSpinner ariaLabel="PC一覧を更新中です" /> : null}
                  <span>再読み込み</span>
                </span>
              )}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <div className="pc-list__content" aria-busy={loading}>
        {items.length === 0 ? (
          <p className="empty-state pc-list__empty">
            {hasActiveFilter ? '該当するPCがありません。' : 'PCがまだ登録されていません。'}
          </p>
        ) : (
          <ul className="pc-row-list">
            {items.map((pc) => {
              const isBusy: PcBusyState = busyById[pc.id] || {}
              const isActive = detailOpen && pc.id === selectedPcId

              return (
                <PcRowItem
                  key={pc.id}
                  pc={pc}
                  isActive={isActive}
                  isBusy={isBusy}
                  statusLabel={STATUS_LABELS[pc.status]}
                  rowError={rowErrorById[pc.id]}
                  onOpenDetail={openDetail}
                  onSendWol={async (pcId) => {
                    onSelectPc?.(pcId)
                    await onSendWol(pcId)
                  }}
                  onRefreshStatus={async (pcId) => {
                    onSelectPc?.(pcId)
                    await onRefreshStatus(pcId)
                  }}
                />
              )
            })}
          </ul>
        )}

        {showInitialLoading ? (
          <div className="pc-list__loading-overlay">
            <LoadingDots label="PC一覧を読み込み中" />
          </div>
        ) : null}
      </div>
    </>
  )

  const portalTarget = typeof document !== 'undefined' ? document.body : null
  const selectedPcDeleteBusy = selectedPc ? Boolean(busyById[selectedPc.id]?.delete) : false

  return (
    <>
      {embedded ? <div className="panel-embedded">{content}</div> : <section className="panel">{content}</section>}
      {portalTarget && detailOpen && selectedPc
        ? createPortal(
            <PcDetailDialog
              selectedPc={selectedPc}
              isEditing={isEditing}
              editForm={editForm}
              editError={editError}
              editLoading={editLoading}
              deleteBusy={selectedPcDeleteBusy}
              rowError={rowErrorById[selectedPc.id]}
              statusLabel={STATUS_LABELS[selectedPc.status]}
              onClose={closeDetail}
              onSubmitEdit={submitEdit}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onOpenDeleteDialog={openDeleteDialog}
              onUpdateEditField={updateEditField}
            />,
            portalTarget,
          )
        : null}
      {portalTarget
        ? createPortal(
            <PcDeleteDialog
              pendingDelete={pendingDelete}
              confirmLoading={confirmLoading}
              onCloseDeleteDialog={closeDeleteDialog}
              onConfirmDelete={confirmAndDelete}
            />,
            portalTarget,
          )
        : null}
    </>
  )
}

export default PcList
