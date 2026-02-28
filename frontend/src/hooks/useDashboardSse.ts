import { useEffect, type MutableRefObject } from 'react'

import { openEvents } from '../api/events'
import { fetchJob } from '../api/jobs'
import { invalidateLogsCache } from '../api/logs'
import { invalidatePcsAndUptimeCache } from '../api/pcs'
import type { PcStatus } from '../types/models'

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

function extractEventJobId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null
  }
  if (typeof data.job_id === 'string' && data.job_id.trim()) {
    return data.job_id.trim()
  }
  if (typeof data.id === 'string' && data.id.trim()) {
    return data.id.trim()
  }
  return null
}

interface UseDashboardSseInput {
  trackedJobIdsRef: MutableRefObject<Set<string>>
  applyPcStatusEvent: (
    pcId: string,
    status: PcStatus,
    updatedAt: string,
    lastSeenAt: string | null,
  ) => void
  loadLogs: () => Promise<void>
  loadPcs: () => Promise<void>
}

export function useDashboardSse({
  trackedJobIdsRef,
  applyPcStatusEvent,
  loadLogs,
  loadPcs,
}: UseDashboardSseInput): void {
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

    const handleJobEvent = (event: Event) => {
      const data = parseEventData(event)
      if (!isTerminalJobState(data?.state)) {
        return
      }

      const jobId = extractEventJobId(data)
      if (!jobId || trackedJobIdsRef.current.has(jobId)) {
        return
      }

      const eventPcId = extractJobPcId(data)
      invalidateLogsCache()
      void loadLogs()

      void (async () => {
        let pcId = eventPcId
        let jobType = ''

        try {
          const response = await fetchJob(jobId)
          jobType = typeof response.job.type === 'string' ? response.job.type : ''
          if (!pcId && response.job.payload && typeof response.job.payload === 'object') {
            pcId = extractJobPcId(response.job.payload as Record<string, unknown>)
          }
        } catch {
          // noop: fetch失敗時はイベントデータのみで判定する
        }

        if (jobType === 'status_refresh_all') {
          invalidatePcsAndUptimeCache()
          await loadPcs()
          return
        }

        if (pcId) {
          invalidatePcsAndUptimeCache(pcId)
          await loadPcs()
        }
      })()
    }

    source.addEventListener('pc_status', handlePcStatusEvent)
    source.addEventListener('job', handleJobEvent)

    return () => {
      source.removeEventListener('pc_status', handlePcStatusEvent)
      source.removeEventListener('job', handleJobEvent)
      source.close()
    }
  }, [applyPcStatusEvent, loadLogs, loadPcs, trackedJobIdsRef])
}
