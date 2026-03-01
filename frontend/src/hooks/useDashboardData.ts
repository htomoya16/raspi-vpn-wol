import { useCallback, useEffect, useRef, useState } from 'react'

import { formatApiError } from '../api/http'
import { invalidateLogsCache } from '../api/logs'
import { refreshAllStatuses, sendPcWol } from '../api/pcs'
import type { PcCreatePayload, PcFilterState, PcUpdatePayload } from '../types/models'
import { useDashboardSse } from './useDashboardSse'
import { useJobTracker } from './useJobTracker'
import { useLogsData } from './useLogsData'
import { usePcData } from './usePcData'

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

interface UseDashboardDataOptions {
  enabled?: boolean
}

export function useDashboardData(options: UseDashboardDataOptions = {}): UseDashboardDataResult {
  const enabled = options.enabled ?? true
  const [notice, setNotice] = useState('')
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const refreshAllInFlightRef = useRef(false)
  const trackedJobIdsRef = useRef<Set<string>>(new Set())

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

  useEffect(() => {
    trackedJobIdsRef.current = new Set(jobs.map((job) => job.id))
  }, [jobs])

  useDashboardSse({
    enabled,
    trackedJobIdsRef,
    applyPcStatusEvent,
    loadLogs,
    loadPcs,
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
    if (!enabled) {
      return
    }
    void loadLogs()
  }, [enabled, loadLogs])

  useEffect(() => {
    if (!enabled) {
      return
    }
    void loadPcs()
  }, [enabled, loadPcs])

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
