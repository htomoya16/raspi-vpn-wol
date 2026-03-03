import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { formatApiError } from '../../api/http'
import { createPc, deletePc, refreshPcStatus, updatePc } from '../../api/pcs'
import type { BusyById, Pc, PcCreatePayload, PcFilterState, PcUpdatePayload, RowErrorById } from '../../types/models'
import { matchesPcFilters } from './matchers'

interface UsePcCrudInput {
  appliedPcFilters: PcFilterState
  loadLogs: () => Promise<void>
  loadPcs: () => Promise<void>
  setNotice: (message: string) => void
  setPcs: Dispatch<SetStateAction<Pc[]>>
  markSyncedNow: () => void
}

interface UsePcCrudResult {
  createLoading: boolean
  createError: string
  busyById: BusyById
  rowErrorById: RowErrorById
  setBusy: (pcId: string, key: keyof BusyById[string], value: boolean) => void
  setRowError: (pcId: string, message: string) => void
  createPcEntry: (payload: PcCreatePayload) => Promise<boolean>
  deletePcEntry: (pcId: string) => Promise<void>
  updatePcEntry: (pcId: string, payload: PcUpdatePayload) => Promise<Pc>
  refreshPcStatusEntry: (pcId: string) => Promise<void>
}

export function usePcCrud({
  appliedPcFilters,
  loadLogs,
  loadPcs,
  setNotice,
  setPcs,
  markSyncedNow,
}: UsePcCrudInput): UsePcCrudResult {
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const createInFlightRef = useRef(false)

  const [busyById, setBusyById] = useState<BusyById>({})
  const [rowErrorById, setRowErrorById] = useState<RowErrorById>({})

  const setBusy = useCallback((pcId: string, key: keyof BusyById[string], value: boolean) => {
    setBusyById((prev) => ({
      ...prev,
      [pcId]: {
        ...(prev[pcId] || {}),
        [key]: value,
      },
    }))
  }, [])

  const setRowError = useCallback((pcId: string, message: string) => {
    setRowErrorById((prev) => ({
      ...prev,
      [pcId]: message,
    }))
  }, [])

  const createPcEntry = useCallback(
    async (payload: PcCreatePayload) => {
      if (createInFlightRef.current) {
        return false
      }

      createInFlightRef.current = true
      setCreateLoading(true)
      setCreateError('')

      try {
        const response = await createPc(payload)
        const createdPc = response.pc
        if (matchesPcFilters(createdPc, appliedPcFilters)) {
          setPcs((prev) => [createdPc, ...prev.filter((pc) => pc.id !== createdPc.id)])
          markSyncedNow()
        }
        setNotice(`PCを登録しました: ${createdPc.name}`)
        void loadPcs()
        void loadLogs()
        return true
      } catch (error) {
        setCreateError(formatApiError(error))
        return false
      } finally {
        createInFlightRef.current = false
        setCreateLoading(false)
      }
    },
    [appliedPcFilters, loadLogs, loadPcs, markSyncedNow, setNotice, setPcs],
  )

  const deletePcEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'delete', true)
      setRowError(pcId, '')

      try {
        await deletePc(pcId)
        setPcs((prev) => prev.filter((pc) => pc.id !== pcId))
        markSyncedNow()
        setNotice(`PCを削除しました: ${pcId}`)
        void loadPcs()
        await loadLogs()
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'delete', false)
      }
    },
    [loadLogs, loadPcs, markSyncedNow, setBusy, setNotice, setPcs, setRowError],
  )

  const updatePcEntry = useCallback(
    async (pcId: string, payload: PcUpdatePayload) => {
      setBusy(pcId, 'update', true)
      setRowError(pcId, '')

      try {
        const data = await updatePc(pcId, payload)
        setPcs((prev) => prev.map((pc) => (pc.id === pcId ? data.pc : pc)))
        setNotice(`PC設定を更新しました: ${pcId}`)
        await loadLogs()
        return data.pc
      } catch (error) {
        const message = formatApiError(error)
        setRowError(pcId, message)
        throw new Error(message)
      } finally {
        setBusy(pcId, 'update', false)
      }
    },
    [loadLogs, setBusy, setNotice, setPcs, setRowError],
  )

  const refreshPcStatusEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'status', true)
      setRowError(pcId, '')

      try {
        const data = await refreshPcStatus(pcId)
        setPcs((prev) => prev.map((pc) => (pc.id === pcId ? data.pc : pc)))
        setNotice(`ステータスを更新しました: ${pcId}`)
        await loadLogs()
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'status', false)
      }
    },
    [loadLogs, setBusy, setNotice, setPcs, setRowError],
  )

  return {
    createLoading,
    createError,
    busyById,
    rowErrorById,
    setBusy,
    setRowError,
    createPcEntry,
    deletePcEntry,
    updatePcEntry,
    refreshPcStatusEntry,
  }
}
