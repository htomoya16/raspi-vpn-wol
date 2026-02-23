import { useCallback, useState } from 'react'

import { formatApiError } from '../api/http'
import { fetchJob } from '../api/jobs'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function useJobTracker({ onTerminal }) {
  const [jobs, setJobs] = useState([])

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
            await onTerminal()
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
    [onTerminal],
  )

  return {
    jobs,
    trackJob,
  }
}
