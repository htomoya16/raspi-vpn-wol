import JobQueue from '../JobQueue'
import LogsPanel from '../LogsPanel'
import PcForm from '../PcForm'
import PcList from '../PcList'
import homeIcon from '../icons/home.svg'
import logIcon from '../icons/log.svg'
import registerIcon from '../icons/register.svg'
import type { JobQueueProps } from '../JobQueue'
import type { LogsPanelProps } from '../LogsPanel'
import type { PcFormProps } from '../PcForm'
import type { PcListProps } from '../PcList'

export type MobileView = 'pcs' | 'create' | 'logs'

interface MobileWorkspaceProps {
  mobileView: MobileView
  onChangeMobileView: (view: MobileView) => void
  pcListProps: PcListProps
  createLoading: PcFormProps['loading']
  createError: PcFormProps['error']
  onCreatePc: PcFormProps['onCreate']
  jobs: JobQueueProps['jobs']
  logsPanelProps: LogsPanelProps
}

function MobileWorkspace({
  mobileView,
  onChangeMobileView,
  pcListProps,
  createLoading,
  createError,
  onCreatePc,
  jobs,
  logsPanelProps,
}: MobileWorkspaceProps) {
  return (
    <>
      <section className="mobile-workspace">
        {mobileView === 'pcs' ? <PcList {...pcListProps} /> : null}

        {mobileView === 'create' ? (
          <PcForm loading={createLoading} error={createError} onCreate={onCreatePc} />
        ) : null}

        {mobileView === 'logs' ? (
          <div className="mobile-workspace__logs">
            <section className="panel column-panel column-panel--right">
              <JobQueue jobs={jobs} embedded />
              <LogsPanel {...logsPanelProps} embedded />
            </section>
          </div>
        ) : null}
      </section>

      <nav className="mobile-bottom-nav" aria-label="表示切替メニュー">
        <button
          type="button"
          className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--stack ${mobileView === 'pcs' ? 'mobile-bottom-nav__btn--active' : ''}`}
          onClick={() => onChangeMobileView('pcs')}
        >
          <img src={homeIcon} alt="" aria-hidden="true" className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">PC一覧</span>
        </button>
        <button
          type="button"
          className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--register ${mobileView === 'create' ? 'mobile-bottom-nav__btn--active' : ''}`}
          onClick={() => onChangeMobileView('create')}
          aria-label="PC登録"
        >
          <span className="mobile-bottom-nav__register-circle" aria-hidden="true">
            <img src={registerIcon} alt="" className="mobile-bottom-nav__icon mobile-bottom-nav__icon--register" />
          </span>
        </button>
        <button
          type="button"
          className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--stack ${mobileView === 'logs' ? 'mobile-bottom-nav__btn--active' : ''}`}
          onClick={() => onChangeMobileView('logs')}
        >
          <img src={logIcon} alt="" aria-hidden="true" className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">ログ</span>
        </button>
      </nav>
    </>
  )
}

export default MobileWorkspace
