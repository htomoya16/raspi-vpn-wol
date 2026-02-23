import { useCallback, useState } from 'react'

import { formatApiError } from '../api/http'
import { clearLogs, listLogs } from '../api/logs'

const DEFAULT_LOG_LIMIT = 200

export function useLogsData({ setNotice }) {
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

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
  }, [setNotice])

  return {
    logs,
    logsLoading,
    logsError,
    loadLogs,
    clearLogsEntry,
  }
}
