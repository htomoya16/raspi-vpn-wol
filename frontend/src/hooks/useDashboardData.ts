import { useCallback, useEffect, useRef, useState } from 'react'

import { openEvents } from '../api/events'
import { formatApiError } from '../api/http'
import { invalidateLogsCache } from '../api/logs'
import { invalidatePcsAndUptimeCache, refreshAllStatuses, sendPcWol } from '../api/pcs'
import type { PcCreatePayload, PcFilterState, PcStatus, PcUpdatePayload } from '../types/models'
import { useJobTracker } from './useJobTracker'
import { useLogsData } from './useLogsData'
import { usePcData } from './usePcData'

const PC_STATUS_VALUES: PcStatus[] = ['online', 'offline', 'unknown', 'booting', 'unreachable']

function isPcStatus(value: unknown): value is PcStatus {
  return typeof value === 'string' && PC_STATUS_VALUES.includes(value as PcStatus)
}

function parseEventData(event: Event): Record<string, unknown> | null {
  if (!(event instanceof MessageEvent)) {
    return null
  }
  if (typeof event.data !== 'string') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(event.data)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function isTerminalJobState(value: unknown): value is 'succeeded' | 'failed' {
  return value === 'succeeded' || value === 'failed'
}

function extractJobPcId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null
  }
  if (typeof data.pc_id === 'string') {
    return data.pc_id
  }

  const payload = data.payload
  if (payload && typeof payload === 'object' && 'pc_id' in payload) {
    const nestedPcId = (payload as { pc_id?: unknown }).pc_id
    if (typeof nestedPcId === 'string') {
      return nestedPcId
    }
  }

  return null
}

export interface UseDashboardDataResult {
  notice: string
  pcs: ReturnType<typeof usePcData>['pcs']
  pcLoading: boolean
  pcError: string
  pcFilters: PcFilterState
  appliedPcFilters: PcFilterState
  createLoading: boolean
  createError: string
  busyById: ReturnType<typeof usePcData>['busyById']
  rowErrorById: ReturnType<typeof usePcData>['rowErrorById']
  logs: ReturnType<typeof useLogsData>['logs']
  logsLoading: boolean
  logsError: string
  jobs: ReturnType<typeof useJobTracker>['jobs']
  refreshAllLoading: boolean
  lastSyncedAt: string
  onlineCount: number
  loadPcs: () => Promise<void>
  loadLogs: () => Promise<void>
  createPcEntry: (payload: PcCreatePayload) => Promise<boolean>
  deletePcEntry: (pcId: string) => Promise<void>
  updatePcEntry: (pcId: string, payload: PcUpdatePayload) => Promise<ReturnType<typeof usePcData>['pcs'][number]>
  refreshPcStatusEntry: (pcId: string) => Promise<void>
  sendPcWolEntry: (pcId: string) => Promise<void>
  refreshAllStatusesEntry: () => Promise<void>
  clearLogsEntry: () => Promise<void>
  handleFilterChange: (key: keyof PcFilterState, value: string) => void
  handleApplyFilters: () => void
  handleClearFilters: () => void
}

export function useDashboardData(): UseDashboardDataResult {
  const [notice, setNotice] = useState('')
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const refreshAllInFlightRef = useRef(false)

  const {
    logs,
    logsLoading,
    logsError,
    loadLogs,
    clearLogsEntry,
  } = useLogsData({ setNotice })

  const {
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
  } = usePcData({ loadLogs, setNotice })

  const refreshFromTerminal = useCallback(async () => {
    await Promise.all([loadPcs(), loadLogs()])
  }, [loadLogs, loadPcs])

  const refreshLogsDuringProgress = useCallback(async () => {
    invalidateLogsCache()
    await loadLogs()
  }, [loadLogs])

  const { jobs, trackJob } = useJobTracker({
    onTerminal: refreshFromTerminal,
    onProgress: refreshLogsDuringProgress,
  })

  const sendPcWolEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'wol', true)
      setRowError(pcId, '')

      try {
        const job = await sendPcWol(pcId)
        setPcStatusLocal(pcId, 'booting')
        setNotice(`WOLジョブを投入しました: ${pcId}`)
        await trackJob(job.job_id, 'WOL送信')
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'wol', false)
      }
    },
    [setBusy, setPcStatusLocal, setRowError, trackJob],
  )

  const refreshAllStatusesEntry = useCallback(async () => {
    if (refreshAllInFlightRef.current) {
      return
    }
    refreshAllInFlightRef.current = true
    setRefreshAllLoading(true)

    try {
      const job = await refreshAllStatuses()
      setNotice('全PCステータス更新ジョブを投入しました')
      await trackJob(job.job_id, '全体ステータス更新')
    } catch (error) {
      setPcError(formatApiError(error))
    } finally {
      setRefreshAllLoading(false)
      refreshAllInFlightRef.current = false
    }
  }, [setPcError, trackJob])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    void loadPcs()
  }, [loadPcs])

  useEffect(() => {
    const source = openEvents()
    if (!source) {
      return undefined
    }

    const handlePcStatusEvent = (event: Event) => {
      const data = parseEventData(event)
      if (!data) {
        return
      }
      const pcId = data.pc_id
      const status = data.status
      const updatedAt = data.updated_at
      const lastSeenAt = data.last_seen_at
      const normalizedLastSeenAt = typeof lastSeenAt === 'string' ? lastSeenAt : null
      if (
        typeof pcId !== 'string' ||
        !isPcStatus(status) ||
        typeof updatedAt !== 'string' ||
        (lastSeenAt !== undefined && lastSeenAt !== null && typeof lastSeenAt !== 'string')
      ) {
        return
      }
      applyPcStatusEvent(pcId, status, updatedAt, normalizedLastSeenAt)
      invalidatePcsAndUptimeCache(pcId)
      invalidateLogsCache()
      void loadLogs()
    }

    const refreshFromJobEvent = (event: Event) => {
      const data = parseEventData(event)
      if (!isTerminalJobState(data?.state)) {
        return
      }
      const pcId = extractJobPcId(data)
      invalidatePcsAndUptimeCache(pcId ?? undefined)
      invalidateLogsCache()
      void loadPcs()
      void loadLogs()
    }

    source.addEventListener('pc_status', handlePcStatusEvent)
    source.addEventListener('job', refreshFromJobEvent)

    return () => {
      source.removeEventListener('pc_status', handlePcStatusEvent)
      source.removeEventListener('job', refreshFromJobEvent)
      source.close()
    }
  }, [applyPcStatusEvent, loadLogs, loadPcs])

  return {
    notice,
    pcs,
    pcLoading,
    pcError,
    pcFilters,
    appliedPcFilters,
    createLoading,
    createError,
    busyById,
    rowErrorById,
    logs,
    logsLoading,
    logsError,
    jobs,
    refreshAllLoading,
    lastSyncedAt,
    onlineCount,
    loadPcs,
    loadLogs,
    createPcEntry,
    deletePcEntry,
    updatePcEntry,
    refreshPcStatusEntry,
    sendPcWolEntry,
    refreshAllStatusesEntry,
    clearLogsEntry,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  }
}
