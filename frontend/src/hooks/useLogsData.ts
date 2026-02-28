import { useCallback, useRef, useState } from 'react'

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
  const loadLogsRequestSeqRef = useRef(0)

  const loadLogs = useCallback(async () => {
    const requestSeq = loadLogsRequestSeqRef.current + 1
    loadLogsRequestSeqRef.current = requestSeq
    setLogsLoading(true)
    setLogsError('')

    try {
      const data = await listLogs({ limit: DEFAULT_LOG_LIMIT })
      if (requestSeq !== loadLogsRequestSeqRef.current) {
        return
      }
      setLogs(data?.items || [])
    } catch (error) {
      if (requestSeq !== loadLogsRequestSeqRef.current) {
        return
      }
      setLogsError(formatApiError(error))
    } finally {
      if (requestSeq === loadLogsRequestSeqRef.current) {
        setLogsLoading(false)
      }
    }
  }, [])

  const clearLogsEntry = useCallback(async () => {
    setLogsError('')
    try {
      const data = await clearLogs()
      loadLogsRequestSeqRef.current += 1
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
