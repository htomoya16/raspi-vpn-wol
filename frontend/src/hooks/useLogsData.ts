import { useCallback, useState } from 'react'

import type { LogEntry } from '../types/models'
import { formatApiError } from '../api/http'
import { clearLogs, listLogs } from '../api/logs'

const DEFAULT_LOG_LIMIT = 200

interface UseLogsDataParams {
  setNotice: (message: string) => void
}

interface UseLogsDataReturn {
  logs: LogEntry[]
  logsLoading: boolean
  logsError: string
  loadLogs: () => Promise<void>
  clearLogsEntry: () => Promise<void>
}

export function useLogsData({ setNotice }: UseLogsDataParams): UseLogsDataReturn {
  const [logs, setLogs] = useState<LogEntry[]>([])
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
