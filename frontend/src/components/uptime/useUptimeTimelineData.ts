import { useEffect, useState } from 'react'

import { formatApiError } from '../../api/http'
import { getPcWeeklyTimeline } from '../../api/pcs'
import { buildMockWeeklyTimeline } from '../../mocks/uptime'
import type { PcWeeklyTimelineResponse } from '../../types/models'

interface UseUptimeTimelineDataInput {
  enabled: boolean
  activePcId: string
  dataVersion: string
  weekStart: string
  tz: string
  useMockData: boolean
  enableMock: boolean
  onSettled: () => void
  onError: () => void
}

interface UseUptimeTimelineDataResult {
  weekly: PcWeeklyTimelineResponse | null
  weeklyLoading: boolean
  weeklyError: string
}

export function useUptimeTimelineData({
  enabled,
  activePcId,
  dataVersion,
  weekStart,
  tz,
  useMockData,
  enableMock,
  onSettled,
  onError,
}: UseUptimeTimelineDataInput): UseUptimeTimelineDataResult {
  const [weekly, setWeekly] = useState<PcWeeklyTimelineResponse | null>(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setWeekly(null)
      setWeeklyError('')
      setWeeklyLoading(false)
      return
    }

    let cancelled = false

    async function runWeeklyFlow() {
      if (!activePcId) {
        if (!cancelled) {
          setWeekly(null)
          setWeeklyError('')
          setWeeklyLoading(false)
          onSettled()
        }
        return
      }

      if (enableMock && useMockData) {
        if (!cancelled) {
          setWeekly(buildMockWeeklyTimeline(activePcId, weekStart, tz))
          setWeeklyError('')
          setWeeklyLoading(false)
          onSettled()
        }
        return
      }

      if (!cancelled) {
        setWeeklyLoading(true)
        setWeeklyError('')
      }

      try {
        const data = await getPcWeeklyTimeline(activePcId, {
          week_start: weekStart,
          tz,
        })
        if (!cancelled) {
          setWeekly(data)
        }
      } catch (error) {
        if (!cancelled) {
          setWeekly(null)
          setWeeklyError(formatApiError(error))
          onError()
        }
      } finally {
        if (!cancelled) {
          setWeeklyLoading(false)
          onSettled()
        }
      }
    }

    void runWeeklyFlow()
    return () => {
      cancelled = true
    }
  }, [activePcId, dataVersion, enableMock, enabled, onError, onSettled, tz, useMockData, weekStart])

  return {
    weekly,
    weeklyLoading,
    weeklyError,
  }
}
