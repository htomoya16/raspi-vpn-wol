export const CACHE_PREFIX = {
  pcsList: 'pcs:list:',
  uptimeSummary: 'uptime:summary:',
  uptimeWeekly: 'uptime:weekly:',
  logsList: 'logs:list:',
} as const

export const CACHE_TTL_MS = {
  pcsList: 30_000,
  uptimeSummary: 120_000,
  uptimeWeekly: 120_000,
  logsList: 10_000,
} as const

export function buildPcsListCacheKey(query: string): string {
  return `${CACHE_PREFIX.pcsList}${query}`
}

export function buildUptimeSummaryCacheKey(pcId: string, query: string): string {
  return `${CACHE_PREFIX.uptimeSummary}pc=${encodeURIComponent(pcId)}:${query}`
}

export function buildUptimeWeeklyCacheKey(pcId: string, query: string): string {
  return `${CACHE_PREFIX.uptimeWeekly}pc=${encodeURIComponent(pcId)}:${query}`
}

export function buildLogsListCacheKey(query: string): string {
  return `${CACHE_PREFIX.logsList}${query}`
}

export function buildUptimeSummaryPcPrefix(pcId: string): string {
  return `${CACHE_PREFIX.uptimeSummary}pc=${encodeURIComponent(pcId)}:`
}

export function buildUptimeWeeklyPcPrefix(pcId: string): string {
  return `${CACHE_PREFIX.uptimeWeekly}pc=${encodeURIComponent(pcId)}:`
}
