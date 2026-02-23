import { useCallback, useMemo, useRef, useState } from 'react'

import type {
  BusyById,
  Pc,
  PcCreatePayload,
  PcFilterState,
  PcUpdatePayload,
  RowErrorById,
} from '../types/models'
import { formatApiError } from '../api/http'
import { createPc, deletePc, listPcs, refreshPcStatus, updatePc } from '../api/pcs'

const DEFAULT_FILTERS: PcFilterState = { q: '', status: '' }

interface UsePcDataParams {
  loadLogs: () => Promise<void>
  setNotice: (message: string) => void
}

interface UsePcDataReturn {
  pcs: Pc[]
  pcLoading: boolean
  pcError: string
  pcFilters: PcFilterState
  appliedPcFilters: PcFilterState
  createLoading: boolean
  createError: string
  busyById: BusyById
  rowErrorById: RowErrorById
  lastSyncedAt: string
  onlineCount: number
  loadPcs: () => Promise<void>
  setBusy: (pcId: string, key: keyof BusyById[string], value: boolean) => void
  setPcError: (message: string) => void
  setRowError: (pcId: string, message: string) => void
  createPcEntry: (payload: PcCreatePayload) => Promise<boolean>
  deletePcEntry: (pcId: string) => Promise<void>
  updatePcEntry: (pcId: string, payload: PcUpdatePayload) => Promise<Pc>
  refreshPcStatusEntry: (pcId: string) => Promise<void>
  handleFilterChange: (key: keyof PcFilterState, value: string) => void
  handleApplyFilters: () => void
  handleClearFilters: () => void
}

export function usePcData({ loadLogs, setNotice }: UsePcDataParams): UsePcDataReturn {
  const [pcs, setPcs] = useState<Pc[]>([])
  const [pcLoading, setPcLoading] = useState(false)
  const [pcError, setPcError] = useState('')
  const [pcFilters, setPcFilters] = useState<PcFilterState>(DEFAULT_FILTERS)
  const [appliedPcFilters, setAppliedPcFilters] = useState<PcFilterState>(DEFAULT_FILTERS)

  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const createInFlightRef = useRef(false)

  const [busyById, setBusyById] = useState<BusyById>({})
  const [rowErrorById, setRowErrorById] = useState<RowErrorById>({})
  const [lastSyncedAt, setLastSyncedAt] = useState('')

  const onlineCount = useMemo(
    () => pcs.filter((pc) => pc.status === 'online').length,
    [pcs],
  )

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

  const loadPcs = useCallback(async () => {
    setPcLoading(true)
    setPcError('')

    try {
      const data = await listPcs({
        q: appliedPcFilters.q,
        status: appliedPcFilters.status,
        limit: 200,
      })
      setPcs(data?.items || [])
      setLastSyncedAt(new Date().toISOString())
    } catch (error) {
      setPcError(formatApiError(error))
    } finally {
      setPcLoading(false)
    }
  }, [appliedPcFilters.q, appliedPcFilters.status])

  const createPcEntry = useCallback(
    async (payload: PcCreatePayload) => {
      if (createInFlightRef.current) {
        return false
      }

      createInFlightRef.current = true
      setCreateLoading(true)
      setCreateError('')

      try {
        await createPc(payload)
        setNotice(`PCを登録しました: ${payload.name}`)
        await Promise.all([loadPcs(), loadLogs()])
        return true
      } catch (error) {
        setCreateError(formatApiError(error))
        return false
      } finally {
        createInFlightRef.current = false
        setCreateLoading(false)
      }
    },
    [loadLogs, loadPcs, setNotice],
  )

  const deletePcEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'delete', true)
      setRowError(pcId, '')

      try {
        await deletePc(pcId)
        setNotice(`PCを削除しました: ${pcId}`)
        await Promise.all([loadPcs(), loadLogs()])
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'delete', false)
      }
    },
    [loadLogs, loadPcs, setBusy, setNotice, setRowError],
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
    [loadLogs, setBusy, setNotice, setRowError],
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
    [loadLogs, setBusy, setNotice, setRowError],
  )

  const handleFilterChange = useCallback((key: keyof PcFilterState, value: string) => {
    setPcFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const handleApplyFilters = useCallback(() => {
    setAppliedPcFilters({ ...pcFilters })
  }, [pcFilters])

  const handleClearFilters = useCallback(() => {
    setPcFilters(DEFAULT_FILTERS)
    setAppliedPcFilters(DEFAULT_FILTERS)
  }, [])

  return {
    pcs,
    pcLoading,
    pcError,
    pcFilters,
    appliedPcFilters,
    createLoading,
    createError,
    busyById,
    rowErrorById,
    lastSyncedAt,
    onlineCount,
    loadPcs,
    setBusy,
    setPcError,
    setRowError,
    createPcEntry,
    deletePcEntry,
    updatePcEntry,
    refreshPcStatusEntry,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  }
}
