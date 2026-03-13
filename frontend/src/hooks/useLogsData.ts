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
  logsLoadingMore: boolean
  logsHasMore: boolean
  logsError: string
  loadLogs: () => Promise<void>
  loadMoreLogs: () => Promise<void>
  clearLogsEntry: () => Promise<void>
}

export function useLogsData({ setNotice }: UseLogsDataParams): UseLogsDataReturn {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsLoadingMore, setLogsLoadingMore] = useState(false)
  const [logsHasMore, setLogsHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [logsError, setLogsError] = useState('')
  const loadLogsRequestSeqRef = useRef(0)

  const loadLogs = useCallback(async () => {
    const requestSeq = loadLogsRequestSeqRef.current + 1
    loadLogsRequestSeqRef.current = requestSeq
    setLogsLoading(true)
    setLogsLoadingMore(false)
    setLogsError('')

    try {
      const data = await listLogs({ limit: DEFAULT_LOG_LIMIT })
      if (requestSeq !== loadLogsRequestSeqRef.current) {
        return
      }
      setLogs(data?.items || [])
      setNextCursor(data?.next_cursor ?? null)
      setLogsHasMore(Boolean(data?.next_cursor))
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

  const loadMoreLogs = useCallback(async () => {
    const requestSeq = loadLogsRequestSeqRef.current
    if (requestSeq < 1 || nextCursor === null || logsLoading || logsLoadingMore) {
      return
    }

    setLogsLoadingMore(true)
    setLogsError('')
    try {
      const data = await listLogs({ limit: DEFAULT_LOG_LIMIT, cursor: nextCursor })
      if (requestSeq !== loadLogsRequestSeqRef.current) {
        return
      }
      setLogs((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        const appended = (data?.items || []).filter((item) => !seen.has(item.id))
        return prev.concat(appended)
      })
      setNextCursor(data?.next_cursor ?? null)
      setLogsHasMore(Boolean(data?.next_cursor))
    } catch (error) {
      if (requestSeq !== loadLogsRequestSeqRef.current) {
        return
      }
      setLogsError(formatApiError(error))
    } finally {
      setLogsLoadingMore(false)
    }
  }, [logsLoading, logsLoadingMore, nextCursor])

  const clearLogsEntry = useCallback(async () => {
    setLogsError('')
    setLogsLoadingMore(false)
    try {
      const data = await clearLogs()
      loadLogsRequestSeqRef.current += 1
      setLogs([])
      setNextCursor(null)
      setLogsHasMore(false)
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
    logsLoadingMore,
    logsHasMore,
    logsError,
    loadLogs,
    loadMoreLogs,
    clearLogsEntry,
  }
}
