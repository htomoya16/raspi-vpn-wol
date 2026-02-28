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

export const PERIODIC_STATUS_GROUP_KEY = 'job:periodic-status'

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
  const periodicStatusGroupJobIds = new Set<string>()
  let currentNormalGroup: LogGroup | null = null

  for (const item of sortedItems) {
    const jobId = extractJobId(item)
    const okCount = item.ok ? 1 : 0
    const ngCount = item.ok ? 0 : 1

    if (jobId) {
      currentNormalGroup = null
      const isPeriodicStatus = isPeriodicStatusJobLog(item)
      const key = isPeriodicStatus ? PERIODIC_STATUS_GROUP_KEY : `job:${jobId}`
      const existing = jobGroupMap.get(key)
      if (existing) {
        existing.items.push(item)
        existing.okCount += okCount
        existing.ngCount += ngCount
        existing.latestLogId = Math.max(existing.latestLogId, item.id)
        existing.jobName = inferJobName(existing.items)
        existing.title = existing.jobName || 'ジョブログ'
        if (isPeriodicStatus) {
          periodicStatusGroupJobIds.add(jobId)
          existing.subtitle = `定期ジョブ ${periodicStatusGroupJobIds.size}件`
        }
        continue
      }

      if (isPeriodicStatus) {
        periodicStatusGroupJobIds.add(jobId)
      }

      const nextGroup: LogGroup = {
        key,
        kind: 'job',
        title: isPeriodicStatus ? '定期ステータス確認' : inferJobName([item]) || 'ジョブログ',
        subtitle: isPeriodicStatus ? `定期ジョブ ${periodicStatusGroupJobIds.size}件` : `ID: ${jobId}`,
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
