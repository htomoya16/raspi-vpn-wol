import type { JobQueueProps } from '../JobQueue'
import type { LogsPanelProps } from '../LogsPanel'
import type { PcFormProps } from '../PcForm'
import type { PcListProps } from '../PcList'

export interface DashboardWorkspaceData {
  pcListProps: PcListProps
  createLoading: PcFormProps['loading']
  createError: PcFormProps['error']
  onCreatePc: PcFormProps['onCreate']
  jobs: JobQueueProps['jobs']
  logsPanelProps: LogsPanelProps
}
