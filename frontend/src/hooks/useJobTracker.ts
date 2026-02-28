import { useCallback, useState } from 'react'

import type { JobResponse, TrackedJob } from '../types/models'
import { formatApiError } from '../api/http'
import { fetchJob } from '../api/jobs'

const JOB_POLL_INTERVAL_MS = 1000
const JOB_POLL_MAX_ATTEMPTS = 90
const JOB_PROGRESS_REFRESH_EVERY_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

interface UseJobTrackerParams {
  onTerminal: () => Promise<void>
  onProgress?: () => Promise<void>
}

interface UseJobTrackerReturn {
  jobs: TrackedJob[]
  trackJob: (jobId: string, label: string) => Promise<void>
}

export function useJobTracker({ onTerminal, onProgress }: UseJobTrackerParams): UseJobTrackerReturn {
  const [jobs, setJobs] = useState<TrackedJob[]>([])

  const trackJob = useCallback(
    async (jobId: string, label: string) => {
      setJobs((prev) => {
        const next = prev.filter((entry) => entry.id !== jobId)
        const queuedJob: TrackedJob = {
          id: jobId,
          label,
          state: 'queued',
          updated_at: new Date().toISOString(),
        }
        return [queuedJob, ...next].slice(0, 12)
      })

      for (let attempt = 0; attempt < JOB_POLL_MAX_ATTEMPTS; attempt += 1) {
        await sleep(JOB_POLL_INTERVAL_MS)

        try {
          const data: JobResponse = await fetchJob(jobId)
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
            await onTerminal()
            return
          }

          if (
            job.state === 'running' &&
            onProgress &&
            (attempt === 0 || (attempt + 1) % JOB_PROGRESS_REFRESH_EVERY_ATTEMPTS === 0)
          ) {
            void onProgress().catch(() => undefined)
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
    [onProgress, onTerminal],
  )

  return {
    jobs,
    trackJob,
  }
}
