import type {
  BusyById,
  Pc,
  PcCreatePayload,
  PcFilterState,
  PcStatus,
  PcUpdatePayload,
  RowErrorById,
} from '../types/models'
import { usePcCollection } from './pc-data/usePcCollection'
import { usePcCrud } from './pc-data/usePcCrud'
import { usePcFilters } from './pc-data/usePcFilters'

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

export function usePcData({ loadLogs, setNotice }: UsePcDataParams): UsePcDataReturn {
  const {
    pcFilters,
    appliedPcFilters,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  } = usePcFilters()

  const {
    pcs,
    pcLoading,
    pcError,
    lastSyncedAt,
    onlineCount,
    loadPcs,
    setPcError,
    setPcs,
    markSyncedNow,
    applyPcStatusEvent,
    setPcStatusLocal,
  } = usePcCollection({ appliedPcFilters })

  const {
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
  } = usePcCrud({
    appliedPcFilters,
    loadLogs,
    loadPcs,
    setNotice,
    setPcs,
    markSyncedNow,
  })

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
