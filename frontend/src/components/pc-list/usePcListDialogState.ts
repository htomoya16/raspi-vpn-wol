import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import type { BusyById, Pc, PcUpdatePayload, RowErrorById } from '../../types/models'
import type { PendingDeleteState } from './PcDeleteDialog'
import { EMPTY_EDIT_FORM, type PcEditFormState } from './constants'
import { toEditForm, toUpdatePayload } from './utils'

interface UsePcListDialogStateInput {
  items: Pc[]
  busyById: BusyById
  onDelete: (pcId: string) => Promise<void>
  onUpdate: (pcId: string, payload: PcUpdatePayload) => Promise<Pc>
  onSelectPc?: (pcId: string) => void
}

interface UsePcListDialogStateResult {
  selectedPcId: string
  detailOpen: boolean
  selectedPc: Pc | null
  pendingDelete: PendingDeleteState | null
  confirmLoading: boolean
  isEditing: boolean
  editLoading: boolean
  editError: string
  editForm: PcEditFormState
  selectedPcDeleteBusy: boolean
  openDetail: (pcId: string) => void
  closeDetail: () => void
  openDeleteDialog: (pcId: string, pcName: string) => void
  closeDeleteDialog: () => void
  confirmAndDelete: () => Promise<void>
  startEdit: () => void
  cancelEdit: () => void
  updateEditField: (key: keyof PcEditFormState, value: string) => void
  submitEdit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

export function usePcListDialogState({
  items,
  busyById,
  onDelete,
  onUpdate,
  onSelectPc,
}: UsePcListDialogStateInput): UsePcListDialogStateResult {
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

  const openDetail = useCallback(
    (pcId: string) => {
      if (confirmLoading || editLoading) {
        return
      }
      setSelectedPcId(pcId)
      onSelectPc?.(pcId)
      setDetailOpen(true)
      setIsEditing(false)
      setEditError('')
    },
    [confirmLoading, editLoading, onSelectPc],
  )

  const closeDetail = useCallback(() => {
    if (confirmLoading || editLoading) {
      return
    }
    setDetailOpen(false)
    setIsEditing(false)
    setEditError('')
  }, [confirmLoading, editLoading])

  const openDeleteDialog = useCallback((pcId: string, pcName: string) => {
    setPendingDelete({ id: pcId, name: pcName })
  }, [])

  const closeDeleteDialog = useCallback(() => {
    if (confirmLoading) {
      return
    }
    setPendingDelete(null)
  }, [confirmLoading])

  const confirmAndDelete = useCallback(async () => {
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
  }, [confirmLoading, onDelete, pendingDelete, selectedPcId])

  const startEdit = useCallback(() => {
    if (!selectedPc) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(true)
  }, [selectedPc])

  const cancelEdit = useCallback(() => {
    if (editLoading) {
      return
    }
    setEditForm(toEditForm(selectedPc))
    setEditError('')
    setIsEditing(false)
  }, [editLoading, selectedPc])

  const updateEditField = useCallback((key: keyof PcEditFormState, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const submitEdit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [editForm, editLoading, onUpdate, selectedPc],
  )

  const selectedPcDeleteBusy = selectedPc ? Boolean(busyById[selectedPc.id]?.delete) : false

  return {
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
  }
}
