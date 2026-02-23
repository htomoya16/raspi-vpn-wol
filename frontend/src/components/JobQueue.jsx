function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString()
}

const JOB_STATE_LABEL = {
  queued: '待機中',
  running: '実行中',
  succeeded: '完了',
  failed: '失敗',
}

function JobQueue({ jobs, embedded = false }) {
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
            {jobs.map((job) => (
              <li key={job.id} className="job-row">
                <div>
                  <p className="job-id">{job.id}</p>
                  <p className="job-type">{job.label || job.type}</p>
                </div>
                <div className="job-meta">
                  <span className={`job-state job-state--${job.state}`}>
                    {JOB_STATE_LABEL[job.state] || job.state}
                  </span>
                  <span>{formatDateTime(job.updated_at || job.created_at)}</span>
                </div>
                {job.error ? <p className="feedback feedback--error">{job.error}</p> : null}
              </li>
            ))}
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
