import type { LogEntry } from '../../types/models'

export type LogGroupKind = 'job' | 'normal'

export interface LogGroup {
  key: string
  kind: LogGroupKind
  title: string
  subtitle: string | null
  jobName: string | null
  okCount: number
  ngCount: number
  latestLogId: number
  items: LogEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  wol: 'WOL送信',
  status: 'ステータス確認',
  pc_upsert: 'PC登録/更新',
  pc_delete: 'PC削除',
  seed_wol: 'WOL送信',
}

export const PERIODIC_STATUS_GROUP_KEY_PREFIX = 'job:periodic-status'
export const PERIODIC_STATUS_GROUP_KEY = PERIODIC_STATUS_GROUP_KEY_PREFIX

export function isPeriodicStatusGroupKey(key: string): boolean {
  return key === PERIODIC_STATUS_GROUP_KEY_PREFIX || key.startsWith(`${PERIODIC_STATUS_GROUP_KEY_PREFIX}:`)
}

export function formatDetails(details: LogEntry['details']): string {
  if (details === null || details === undefined || details === '') {
    return '-'
  }
  if (typeof details === 'string') {
    const trimmed = details.trim()
    if (trimmed === '') {
      return '-'
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // noop: 文字列のまま表示する
    }
    return details.replace(/\r\n/g, '\n')
  }
  if (typeof details === 'object') {
    return JSON.stringify(details, null, 2)
  }
  return String(details)
}

export function extractJobId(item: LogEntry): string | null {
  if (typeof item.job_id === 'string') {
    const normalized = item.job_id.trim()
    if (normalized) {
      return normalized
    }
  }
  return null
}

function isPeriodicStatusJobLog(item: LogEntry): boolean {
  return Boolean(extractJobId(item)) && item.action === 'status' && item.event_kind === 'periodic_status'
}

function inferJobName(items: LogEntry[]): string | null {
  const actions = items.map((item) => item.action).filter(Boolean)
  if (actions.length === 0) {
    return null
  }
  const hasWol = actions.some((action) => action === 'wol' || action === 'seed_wol')
  if (hasWol) {
    return 'WOL送信'
  }
  const hasPeriodicStatus = items.some(
    (item) => item.action === 'status' && item.event_kind === 'periodic_status',
  )
  if (hasPeriodicStatus) {
    return '定期ステータス確認'
  }
  const hasBulkStatus = actions.some((action) => action === 'status')
  if (hasBulkStatus) {
    return '全体ステータス更新'
  }

  const uniqueActions = Array.from(new Set(actions))
  if (uniqueActions.length === 1) {
    return ACTION_LABELS[uniqueActions[0]] || uniqueActions[0]
  }

  return '複合処理'
}

export function getActionLabel(item: LogEntry): string {
  if (item.action === 'status' && item.event_kind === 'periodic_status' && extractJobId(item)) {
    return '定期ステータス確認'
  }
  if (item.action === 'status' && extractJobId(item)) {
    return '全体ステータス更新'
  }
  return ACTION_LABELS[item.action] || item.action
}

export function buildLogGroups(items: LogEntry[]): LogGroup[] {
  const sortedItems = [...items].sort((a, b) => b.id - a.id)
  const groups: LogGroup[] = []
  const jobGroupMap = new Map<string, LogGroup>()
  let currentNormalGroup: LogGroup | null = null
  let currentPeriodicStatusGroup: LogGroup | null = null
  let currentPeriodicStatusJobIds = new Set<string>()

  for (const item of sortedItems) {
    const jobId = extractJobId(item)
    const okCount = item.ok ? 1 : 0
    const ngCount = item.ok ? 0 : 1

    if (jobId && isPeriodicStatusJobLog(item)) {
      currentNormalGroup = null
      if (!currentPeriodicStatusGroup) {
        currentPeriodicStatusJobIds = new Set<string>()
        currentPeriodicStatusGroup = {
          key: `${PERIODIC_STATUS_GROUP_KEY_PREFIX}:${item.id}`,
          kind: 'job',
          title: '定期ステータス確認',
          subtitle: '定期ジョブ 0件',
          jobName: '定期ステータス確認',
          okCount: 0,
          ngCount: 0,
          latestLogId: item.id,
          items: [],
        }
        groups.push(currentPeriodicStatusGroup)
      }

      currentPeriodicStatusGroup.items.push(item)
      currentPeriodicStatusGroup.okCount += okCount
      currentPeriodicStatusGroup.ngCount += ngCount
      currentPeriodicStatusGroup.latestLogId = Math.max(currentPeriodicStatusGroup.latestLogId, item.id)
      currentPeriodicStatusJobIds.add(jobId)
      currentPeriodicStatusGroup.subtitle = `定期ジョブ ${currentPeriodicStatusJobIds.size}件`
      continue
    }

    currentPeriodicStatusGroup = null

    if (jobId) {
      currentNormalGroup = null
      const key = `job:${jobId}`
      const existing = jobGroupMap.get(key)
      if (existing) {
        existing.items.push(item)
        existing.okCount += okCount
        existing.ngCount += ngCount
        existing.latestLogId = Math.max(existing.latestLogId, item.id)
        existing.jobName = inferJobName(existing.items)
        existing.title = existing.jobName || 'ジョブログ'
        continue
      }

      const nextGroup: LogGroup = {
        key,
        kind: 'job',
        title: inferJobName([item]) || 'ジョブログ',
        subtitle: `ID: ${jobId}`,
        jobName: inferJobName([item]),
        okCount,
        ngCount,
        latestLogId: item.id,
        items: [item],
      }
      jobGroupMap.set(key, nextGroup)
      groups.push(nextGroup)
      continue
    }

    if (!currentNormalGroup) {
      currentNormalGroup = {
        key: `normal:${item.id}`,
        kind: 'normal',
        title: '通常ログ',
        subtitle: null,
        jobName: null,
        okCount: 0,
        ngCount: 0,
        latestLogId: item.id,
        items: [],
      }
      groups.push(currentNormalGroup)
    }
    currentNormalGroup.items.push(item)
    currentNormalGroup.okCount += okCount
    currentNormalGroup.ngCount += ngCount
    currentNormalGroup.latestLogId = Math.max(currentNormalGroup.latestLogId, item.id)
  }

  return groups.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => b.id - a.id),
  }))
}
