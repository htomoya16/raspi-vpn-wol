import { useEffect, useState } from 'react'

import { formatApiError } from '../../api/http'
import { getPcUptimeSummary } from '../../api/pcs'
import { buildMockUptimeSummary } from '../../mocks/uptime'
import type { PcUptimeSummaryResponse, UptimeBucket } from '../../types/models'

interface UseUptimeSummaryDataInput {
  enabled: boolean
  activePcId: string
  dataVersion: string
  from: string
  to: string
  apiBucket: UptimeBucket
  tz: string
  useMockData: boolean
  enableMock: boolean
  onSettled: () => void
  onError: () => void
}

interface UseUptimeSummaryDataResult {
  summary: PcUptimeSummaryResponse | null
  summaryLoading: boolean
  summaryError: string
}

export function useUptimeSummaryData({
  enabled,
  activePcId,
  dataVersion,
  from,
  to,
  apiBucket,
  tz,
  useMockData,
  enableMock,
  onSettled,
  onError,
}: UseUptimeSummaryDataInput): UseUptimeSummaryDataResult {
  const [summary, setSummary] = useState<PcUptimeSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setSummary(null)
      setSummaryError('')
      setSummaryLoading(false)
      return
    }

    let cancelled = false

    async function runSummaryFlow() {
      if (!activePcId) {
        if (!cancelled) {
          setSummary(null)
          setSummaryError('')
          setSummaryLoading(false)
          onSettled()
        }
        return
      }

      if (enableMock && useMockData) {
        if (!cancelled) {
          setSummary(buildMockUptimeSummary(activePcId, apiBucket, from, to, tz))
          setSummaryError('')
          setSummaryLoading(false)
          onSettled()
        }
        return
      }

      if (!cancelled) {
        setSummaryLoading(true)
        setSummaryError('')
      }

      try {
        const data = await getPcUptimeSummary(activePcId, {
          from,
          to,
          bucket: apiBucket,
          tz,
        })
        if (!cancelled) {
          setSummary(data)
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null)
          setSummaryError(formatApiError(error))
          onError()
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
          onSettled()
        }
      }
    }

    void runSummaryFlow()
    return () => {
      cancelled = true
    }
  }, [activePcId, apiBucket, dataVersion, enableMock, enabled, from, onError, onSettled, to, tz, useMockData])

  return {
    summary,
    summaryLoading,
    summaryError,
  }
}
