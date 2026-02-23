import { useCallback, useEffect, useState } from 'react'

import { openEvents } from '../api/events'
import { formatApiError } from '../api/http'
import { refreshAllStatuses, sendPcWol } from '../api/pcs'
import { useJobTracker } from './useJobTracker'
import { useLogsData } from './useLogsData'
import { usePcData } from './usePcData'

export function useDashboardData() {
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
    async (pcId) => {
      setBusy(pcId, 'wol', true)
      setRowError(pcId, '')

      try {
        const job = await sendPcWol(pcId)
        setNotice(`WOLジョブを投入しました: ${pcId}`)
        trackJob(job.job_id, 'WOL送信')
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'wol', false)
      }
    },
    [setBusy, setNotice, setRowError, trackJob],
  )

  const refreshAllStatusesEntry = useCallback(async () => {
    setRefreshAllLoading(true)

    try {
      const job = await refreshAllStatuses()
      setNotice('全PCステータス更新ジョブを投入しました')
      trackJob(job.job_id, '全体ステータス更新')
    } catch (error) {
      setPcError(formatApiError(error))
    } finally {
      setRefreshAllLoading(false)
    }
  }, [setNotice, setPcError, trackJob])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    loadPcs()
  }, [loadPcs])

  useEffect(() => {
    const source = openEvents()
    if (!source) {
      return undefined
    }

    const refreshFromEvent = () => {
      loadPcs()
      loadLogs()
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
