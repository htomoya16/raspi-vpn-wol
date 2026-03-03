import { useEffect, useMemo, useState } from 'react'

import type { JobState, TrackedJob } from '../types/models'
import { formatLocalTime, parseDate } from '../utils/datetime'

const JOB_STATE_LABEL: Record<JobState, string> = {
  queued: '待機中',
  running: '実行中',
  succeeded: '完了',
  failed: '失敗',
}

export interface JobQueueProps {
  jobs: TrackedJob[]
  embedded?: boolean
}

function formatElapsedSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function JobQueue({ jobs, embedded = false }: JobQueueProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const hasRunningJob = useMemo(
    () => jobs.some((job) => job.state === 'running'),
    [jobs],
  )

  useEffect(() => {
    if (!hasRunningJob) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [hasRunningJob])

  function getElapsedLabel(job: TrackedJob): string | null {
    if (job.state !== 'running') {
      return null
    }
    const startedAt = parseDate(job.started_at || job.updated_at || job.created_at)
    if (!startedAt) {
      return null
    }
    const seconds = Math.max(0, Math.floor((nowMs - startedAt.getTime()) / 1000))
    return `経過: ${formatElapsedSeconds(seconds)}`
  }

  const content = (
    <>
      <div className="panel__header">
        <h2>ジョブ状態</h2>
        <p>非同期処理の進行状況を表示します。</p>
      </div>

      {jobs.length === 0 ? (
        <p className="empty-state">ジョブはまだありません。</p>
      ) : (
        <div className="job-list-wrap">
          <ul className="job-list">
            {jobs.map((job) => {
              const elapsedLabel = getElapsedLabel(job)
              return (
                <li key={job.id} className="job-row">
                  <div>
                    <p className="job-id">{job.id}</p>
                    <p className="job-type">{job.label || job.type}</p>
                  </div>
                  <div className="job-meta">
                    <span className={`job-state job-state--${job.state}`}>
                      {JOB_STATE_LABEL[job.state] || job.state}
                    </span>
                    <div className="job-meta__time">
                      <span>{formatLocalTime(job.updated_at || job.created_at, { fallback: '-' })}</span>
                      {elapsedLabel ? <span className="job-elapsed">{elapsedLabel}</span> : null}
                    </div>
                  </div>
                  {job.error ? <p className="feedback feedback--error">{job.error}</p> : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="panel-embedded panel-embedded--job">{content}</div>
  }

  return <section className="panel">{content}</section>
}

export default JobQueue
