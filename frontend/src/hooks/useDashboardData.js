import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { openEvents } from '../api/events'
import { formatApiError } from '../api/http'
import { fetchJob } from '../api/jobs'
import { clearLogs, listLogs } from '../api/logs'
import {
  createPc,
  deletePc,
  listPcs,
  refreshAllStatuses,
  refreshPcStatus,
  sendPcWol,
  updatePc,
} from '../api/pcs'

const DEFAULT_LOG_LIMIT = 200
const DEFAULT_FILTERS = { q: '', status: '' }

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function useDashboardData() {
  const [notice, setNotice] = useState('')

  const [pcs, setPcs] = useState([])
  const [pcLoading, setPcLoading] = useState(false)
  const [pcError, setPcError] = useState('')
  const [pcFilters, setPcFilters] = useState(DEFAULT_FILTERS)
  const [appliedPcFilters, setAppliedPcFilters] = useState(DEFAULT_FILTERS)

  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const createInFlightRef = useRef(false)

  const [busyById, setBusyById] = useState({})
  const [rowErrorById, setRowErrorById] = useState({})

  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  const [jobs, setJobs] = useState([])
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState('')

  const onlineCount = useMemo(
    () => pcs.filter((pc) => pc.status === 'online').length,
    [pcs],
  )

  const setBusy = useCallback((pcId, key, value) => {
    setBusyById((prev) => ({
      ...prev,
      [pcId]: {
        ...(prev[pcId] || {}),
        [key]: value,
      },
    }))
  }, [])

  const setRowError = useCallback((pcId, message) => {
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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError('')

    try {
      const data = await listLogs({ limit: DEFAULT_LOG_LIMIT })
      setLogs(data?.items || [])
    } catch (error) {
      setLogsError(formatApiError(error))
    } finally {
      setLogsLoading(false)
    }
  }, [])

  const trackJob = useCallback(
    async (jobId, label) => {
      setJobs((prev) => {
        const next = prev.filter((entry) => entry.id !== jobId)
        return [{ id: jobId, label, state: 'queued', updated_at: new Date().toISOString() }, ...next].slice(0, 12)
      })

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(1000)

        try {
          const data = await fetchJob(jobId)
          const job = data.job

          setJobs((prev) =>
            prev.map((entry) =>
              entry.id === jobId
                ? {
                    ...job,
                    label,
                  }
                : entry,
            ),
          )

          if (job.state === 'succeeded' || job.state === 'failed') {
            await Promise.all([loadPcs(), loadLogs()])
            return
          }
        } catch (error) {
          setJobs((prev) =>
            prev.map((entry) =>
              entry.id === jobId
                ? {
                    ...entry,
                    state: 'failed',
                    error: formatApiError(error),
                    updated_at: new Date().toISOString(),
                  }
                : entry,
            ),
          )
          return
        }
      }

      setJobs((prev) =>
        prev.map((entry) =>
          entry.id === jobId
            ? {
                ...entry,
                state: 'failed',
                error: 'ジョブ監視がタイムアウトしました',
                updated_at: new Date().toISOString(),
              }
            : entry,
        ),
      )
    },
    [loadLogs, loadPcs],
  )

  const createPcEntry = useCallback(
    async (payload) => {
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
    [loadLogs, loadPcs],
  )

  const deletePcEntry = useCallback(
    async (pcId) => {
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
    [loadLogs, loadPcs, setBusy, setRowError],
  )

  const updatePcEntry = useCallback(
    async (pcId, payload) => {
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
    [loadLogs, setBusy, setRowError],
  )

  const refreshPcStatusEntry = useCallback(
    async (pcId) => {
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
    [loadLogs, setBusy, setRowError],
  )

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
    [setBusy, setRowError, trackJob],
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
  }, [trackJob])

  const clearLogsEntry = useCallback(async () => {
    setLogsError('')
    try {
      const data = await clearLogs()
      setLogs([])
      const deleted = Number(data?.deleted || 0)
      setNotice(`ログを削除しました: ${deleted}件`)
    } catch (error) {
      setLogsError(formatApiError(error))
      throw error
    }
  }, [])

  const handleFilterChange = useCallback((key, value) => {
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
