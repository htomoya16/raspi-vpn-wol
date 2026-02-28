import { useCallback, useMemo, useRef, useState } from 'react'

import type {
  BusyById,
  Pc,
  PcCreatePayload,
  PcFilterState,
  PcStatus,
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
  applyPcStatusEvent: (pcId: string, status: PcStatus, updatedAt: string, lastSeenAt: string | null) => void
  setPcStatusLocal: (pcId: string, status: PcStatus) => void
  handleFilterChange: (key: keyof PcFilterState, value: string) => void
  handleApplyFilters: () => void
  handleClearFilters: () => void
}

function matchesPcFilters(pc: Pc, filters: PcFilterState): boolean {
  const normalizedQuery = filters.q.trim().toLowerCase()
  if (normalizedQuery) {
    const haystacks = [
      pc.id,
      pc.name,
      pc.mac,
      pc.ip || '',
      ...(pc.tags || []),
      pc.note || '',
    ].map((value) => value.toLowerCase())
    const matched = haystacks.some((value) => value.includes(normalizedQuery))
    if (!matched) {
      return false
    }
  }

  if (filters.status && pc.status !== filters.status) {
    return false
  }

  return true
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
  const loadPcsRequestSeqRef = useRef(0)

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
    const requestSeq = loadPcsRequestSeqRef.current + 1
    loadPcsRequestSeqRef.current = requestSeq
    setPcLoading(true)
    setPcError('')

    try {
      const data = await listPcs({
        q: appliedPcFilters.q,
        status: appliedPcFilters.status,
        limit: 200,
      })
      if (requestSeq !== loadPcsRequestSeqRef.current) {
        return
      }
      setPcs(data?.items || [])
      setLastSyncedAt(new Date().toISOString())
    } catch (error) {
      if (requestSeq !== loadPcsRequestSeqRef.current) {
        return
      }
      setPcError(formatApiError(error))
    } finally {
      if (requestSeq === loadPcsRequestSeqRef.current) {
        setPcLoading(false)
      }
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
        const response = await createPc(payload)
        const createdPc = response.pc
        if (matchesPcFilters(createdPc, appliedPcFilters)) {
          setPcs((prev) => [createdPc, ...prev.filter((pc) => pc.id !== createdPc.id)])
          setLastSyncedAt(new Date().toISOString())
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
    [appliedPcFilters, loadLogs, loadPcs, setNotice],
  )

  const deletePcEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'delete', true)
      setRowError(pcId, '')

      try {
        await deletePc(pcId)
        setPcs((prev) => prev.filter((pc) => pc.id !== pcId))
        setLastSyncedAt(new Date().toISOString())
        setNotice(`PCを削除しました: ${pcId}`)
        void loadPcs()
        await loadLogs()
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

  const applyPcStatusEvent = useCallback(
    (pcId: string, status: PcStatus, updatedAt: string, lastSeenAt: string | null) => {
      setPcs((prev) =>
        prev.map((pc) =>
          pc.id === pcId
            ? {
                ...pc,
                status,
                updated_at: updatedAt,
                last_seen_at: lastSeenAt,
              }
            : pc,
        ),
      )
      setLastSyncedAt(new Date().toISOString())
    },
    [],
  )

  const setPcStatusLocal = useCallback((pcId: string, status: PcStatus) => {
    const updatedAt = new Date().toISOString()
    setPcs((prev) =>
      prev.map((pc) =>
        pc.id === pcId
          ? {
              ...pc,
              status,
              updated_at: updatedAt,
            }
          : pc,
      ),
    )
    setLastSyncedAt(updatedAt)
  }, [])

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
    applyPcStatusEvent,
    setPcStatusLocal,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  }
}
