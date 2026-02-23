import { useCallback, useEffect, useState } from 'react'

import { openEvents } from '../api/events'
import { formatApiError } from '../api/http'
import { refreshAllStatuses, sendPcWol } from '../api/pcs'
import type { PcCreatePayload, PcFilterState, PcUpdatePayload } from '../types/models'
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

export function useDashboardData(): UseDashboardDataResult {
  const [notice, setNotice] = useState('')
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)

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
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  } = usePcData({ loadLogs, setNotice })

  const refreshFromTerminal = useCallback(async () => {
    await Promise.all([loadPcs(), loadLogs()])
  }, [loadLogs, loadPcs])

  const { jobs, trackJob } = useJobTracker({
    onTerminal: refreshFromTerminal,
  })

  const sendPcWolEntry = useCallback(
    async (pcId: string) => {
      setBusy(pcId, 'wol', true)
      setRowError(pcId, '')

      try {
        const job = await sendPcWol(pcId)
        setNotice(`WOLジョブを投入しました: ${pcId}`)
        await trackJob(job.job_id, 'WOL送信')
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'wol', false)
      }
    },
    [setBusy, setRowError, trackJob],
  )

  const refreshAllStatusesEntry = useCallback(async () => {
    setRefreshAllLoading(true)

    try {
      const job = await refreshAllStatuses()
      setNotice('全PCステータス更新ジョブを投入しました')
      await trackJob(job.job_id, '全体ステータス更新')
    } catch (error) {
      setPcError(formatApiError(error))
    } finally {
      setRefreshAllLoading(false)
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

    const refreshFromEvent = () => {
      void loadPcs()
      void loadLogs()
    }

    source.addEventListener('pc_status', refreshFromEvent)
    source.addEventListener('job', refreshFromEvent)

    return () => {
      source.removeEventListener('pc_status', refreshFromEvent)
      source.removeEventListener('job', refreshFromEvent)
      source.close()
    }
  }, [loadLogs, loadPcs])

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
