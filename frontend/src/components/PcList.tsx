import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '../hooks/useMediaQuery'
import type { BusyById, Pc, PcFilterState, PcUpdatePayload, RowErrorById } from '../types/models'
import PcDeleteDialog from './pc-list/PcDeleteDialog'
import PcDetailDialog from './pc-list/PcDetailDialog'
import PcListContent from './pc-list/PcListContent'
import PcListFilters from './pc-list/PcListFilters'
import PcListHeader from './pc-list/PcListHeader'
import { STATUS_LABELS } from './pc-list/constants'
import { usePcListDialogState } from './pc-list/usePcListDialogState'

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
  const {
    selectedPcId,
    detailOpen,
    selectedPc,
    pendingDelete,
    confirmLoading,
    isEditing,
    editLoading,
    editError,
    editForm,
    selectedPcDeleteBusy,
    openDetail,
    closeDetail,
    openDeleteDialog,
    closeDeleteDialog,
    confirmAndDelete,
    startEdit,
    cancelEdit,
    updateEditField,
    submitEdit,
  } = usePcListDialogState({
    items,
    busyById,
    onDelete,
    onUpdate,
    onSelectPc,
  })

  const activeFilters = appliedFilters || filters
  const hasActiveFilter = Boolean((activeFilters.q || '').trim() || activeFilters.status)
  const hasItems = items.length > 0
  const showInitialLoading = loading && !hasItems

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


  const content = (
    <>
      <PcListHeader lastSyncedAt={lastSyncedAt} />

      <PcListFilters
        isMobile={isMobile}
        showFilters={showFilters}
        loading={loading}
        filters={filters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        onFilterChange={onFilterChange}
        onApplyFilters={onApplyFilters}
        onClearFilters={onClearFilters}
        onReload={onReload}
        showInitialLoading={showInitialLoading}
      />

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <PcListContent
        items={items}
        loading={loading}
        showInitialLoading={showInitialLoading}
        hasActiveFilter={hasActiveFilter}
        detailOpen={detailOpen}
        selectedPcId={selectedPcId}
        busyById={busyById}
        rowErrorById={rowErrorById}
        onOpenDetail={openDetail}
        onSelectPc={onSelectPc}
        onSendWol={onSendWol}
        onRefreshStatus={onRefreshStatus}
      />
    </>
  )

  const portalTarget = typeof document !== 'undefined' ? document.body : null

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
