import JobQueue from '../JobQueue'
import LogsPanel from '../LogsPanel'
import PcForm from '../PcForm'
import PcList from '../PcList'

function DesktopWorkspace({
  leftView,
  onChangeLeftView,
  pcListProps,
  createLoading,
  createError,
  onCreatePc,
  jobs,
  logsPanelProps,
}) {
  return (
    <section className="workspace-grid">
      <div className="workspace-grid__left">
        <section className="panel column-panel column-panel--left">
          <div className="view-tabs">
            <div className="view-tabs__buttons" data-active={leftView}>
              <span className="tab-slider" aria-hidden="true" />
              <button
                type="button"
                className={`tab-btn ${leftView === 'list' ? 'tab-btn--active' : ''}`}
                onClick={() => onChangeLeftView('list')}
              >
                PC一覧
              </button>
              <button
                type="button"
                className={`tab-btn ${leftView === 'create' ? 'tab-btn--active' : ''}`}
                onClick={() => onChangeLeftView('create')}
              >
                PC登録
              </button>
            </div>
          </div>

          {leftView === 'create' ? (
            <PcForm loading={createLoading} error={createError} onCreate={onCreatePc} embedded />
          ) : (
            <PcList {...pcListProps} embedded />
          )}
        </section>
      </div>

      <div className="workspace-grid__right">
        <section className="panel column-panel column-panel--right">
          <JobQueue jobs={jobs} embedded />
          <LogsPanel {...logsPanelProps} embedded />
        </section>
      </div>
    </section>
  )
}

export default DesktopWorkspace
