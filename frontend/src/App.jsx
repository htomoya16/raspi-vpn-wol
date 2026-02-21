import { useCallback, useEffect, useMemo, useState } from 'react'

import './App.css'
import AppHeader from './components/AppHeader'
import JobQueue from './components/JobQueue'
import LogsPanel from './components/LogsPanel'
import PcForm from './components/PcForm'
import PcList from './components/PcList'
import { openEvents } from './api/events'
import { fetchHealth } from './api/health'
import { formatApiError } from './api/http'
import { fetchJob } from './api/jobs'
import { listLogs } from './api/logs'
import {
  createPc,
  deletePc,
  listPcs,
  refreshAllStatuses,
  refreshPcStatus,
  sendPcWol,
} from './api/pcs'

const DEFAULT_LOG_LIMIT = 50
const DEFAULT_FILTERS = { q: '', status: '' }

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function App() {
  const [notice, setNotice] = useState('')

  const [healthStatus, setHealthStatus] = useState('未確認')
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')

  const [pcs, setPcs] = useState([])
  const [pcLoading, setPcLoading] = useState(false)
  const [pcError, setPcError] = useState('')
  const [pcFilters, setPcFilters] = useState(DEFAULT_FILTERS)
  const [appliedPcFilters, setAppliedPcFilters] = useState(DEFAULT_FILTERS)

  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [busyById, setBusyById] = useState({})
  const [rowErrorById, setRowErrorById] = useState({})

  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [logsLimit, setLogsLimit] = useState(DEFAULT_LOG_LIMIT)

  const [jobs, setJobs] = useState([])
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const [leftView, setLeftView] = useState('list')

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

  const checkHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError('')

    try {
      const data = await fetchHealth()
      setHealthStatus(data?.status || 'unknown')
    } catch (error) {
      setHealthError(formatApiError(error))
    } finally {
      setHealthLoading(false)
    }
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

  const loadLogs = useCallback(async (limit = DEFAULT_LOG_LIMIT) => {
    setLogsLoading(true)
    setLogsError('')

    try {
      const data = await listLogs({ limit })
      setLogsLimit(limit)
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
            await Promise.all([loadPcs(), loadLogs(logsLimit)])
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
    [loadLogs, loadPcs, logsLimit],
  )

  const handleCreatePc = useCallback(
    async (payload) => {
      setCreateLoading(true)
      setCreateError('')

      try {
        await createPc(payload)
        setNotice(`PCを登録しました: ${payload.name}`)
        setLeftView('list')
        await Promise.all([loadPcs(), loadLogs(logsLimit)])
        return true
      } catch (error) {
        setCreateError(formatApiError(error))
        return false
      } finally {
        setCreateLoading(false)
      }
    },
    [loadLogs, loadPcs, logsLimit],
  )

  const handleDeletePc = useCallback(
    async (pcId) => {
      setBusy(pcId, 'delete', true)
      setRowError(pcId, '')

      try {
        await deletePc(pcId)
        setNotice(`PCを削除しました: ${pcId}`)
        await Promise.all([loadPcs(), loadLogs(logsLimit)])
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'delete', false)
      }
    },
    [loadLogs, loadPcs, logsLimit, setBusy, setRowError],
  )

  const handleRefreshStatus = useCallback(
    async (pcId) => {
      setBusy(pcId, 'status', true)
      setRowError(pcId, '')

      try {
        const data = await refreshPcStatus(pcId)
        setPcs((prev) => prev.map((pc) => (pc.id === pcId ? data.pc : pc)))
        setNotice(`ステータスを更新しました: ${pcId}`)
        await loadLogs(logsLimit)
      } catch (error) {
        setRowError(pcId, formatApiError(error))
      } finally {
        setBusy(pcId, 'status', false)
      }
    },
    [loadLogs, logsLimit, setBusy, setRowError],
  )

  const handleSendWol = useCallback(
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

  const handleRefreshAllStatuses = useCallback(async () => {
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
    checkHealth()
    loadLogs(DEFAULT_LOG_LIMIT)
  }, [checkHealth, loadLogs])

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
      loadLogs(logsLimit)
    }

    source.addEventListener('pc_status', refreshFromEvent)
    source.addEventListener('job', refreshFromEvent)

    return () => {
      source.removeEventListener('pc_status', refreshFromEvent)
      source.removeEventListener('job', refreshFromEvent)
      source.close()
    }
  }, [loadLogs, loadPcs, logsLimit])

  return (
    <main className="app-layout">
      <AppHeader
        healthStatus={healthStatus}
        healthError={healthError}
        healthLoading={healthLoading}
        totalCount={pcs.length}
        onlineCount={onlineCount}
        lastSyncedAt={lastSyncedAt}
        refreshAllLoading={refreshAllLoading}
        onCheckHealth={checkHealth}
        onRefreshAllStatuses={handleRefreshAllStatuses}
      />

      {notice ? <p className="feedback feedback--notice">{notice}</p> : null}

      <section className="workspace-grid">
        <div className="workspace-grid__left">
          <section className="panel view-tabs">
            <div className="view-tabs__buttons" data-active={leftView}>
              <span className="tab-slider" aria-hidden="true" />
              <button
                type="button"
                className={`tab-btn ${leftView === 'list' ? 'tab-btn--active' : ''}`}
                onClick={() => setLeftView('list')}
              >
                PC一覧
              </button>
              <button
                type="button"
                className={`tab-btn ${leftView === 'create' ? 'tab-btn--active' : ''}`}
                onClick={() => setLeftView('create')}
              >
                PC登録
              </button>
            </div>
          </section>

          {leftView === 'create' ? (
            <PcForm loading={createLoading} error={createError} onCreate={handleCreatePc} />
          ) : (
            <PcList
              items={pcs}
              loading={pcLoading}
              error={pcError}
              filters={pcFilters}
              onFilterChange={handleFilterChange}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
              onReload={loadPcs}
              onRefreshStatus={handleRefreshStatus}
              onSendWol={handleSendWol}
              onDelete={handleDeletePc}
              busyById={busyById}
              rowErrorById={rowErrorById}
            />
          )}
        </div>

        <div className="workspace-grid__right">
          <JobQueue jobs={jobs} />
          <LogsPanel
            items={logs}
            loading={logsLoading}
            error={logsError}
            limit={logsLimit}
            onLimitChange={loadLogs}
            onReload={() => loadLogs(logsLimit)}
          />
        </div>
      </section>
    </main>
  )
}

export default App
