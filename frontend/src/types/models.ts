export type PcStatus = 'online' | 'offline' | 'unknown' | 'booting' | 'unreachable'

export interface Pc {
  id: string
  name: string
  mac: string
  ip: string
  tags: string[]
  note: string | null
  status: PcStatus
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface PcListResponse {
  items: Pc[]
  next_cursor: string | null
}

export interface PcResponse {
  pc: Pc
}

export interface PcCreatePayload {
  id?: string | null
  name: string
  mac: string
  ip: string
  tags: string[]
  note: string | null
}

export interface PcUpdatePayload {
  name?: string | null
  mac?: string | null
  ip?: string
  tags?: string[] | null
  note?: string | null
}

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed'

export interface Job {
  id: string
  type: string
  state: JobState
  payload: unknown
  result: unknown
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface TrackedJob extends Partial<Job> {
  id: string
  state: JobState
  label?: string
  updated_at: string
}

export interface JobResponse {
  job: Job
}

export interface JobAccepted {
  job_id: string
  state: JobState
}

export interface LogEntry {
  id: number
  pc_id: string | null
  job_id?: string | null
  action: string
  event_kind?: string
  ok: boolean
  message: string | null
  details: unknown
  created_at: string
}

export interface LogListResponse {
  items: LogEntry[]
  next_cursor: number | null
}

export interface LogClearResponse {
  deleted: number
}

export interface HealthResponse {
  status: string
}

export interface PcFilterState {
  q: string
  status: string
}

export interface PcBusyState {
  delete?: boolean
  update?: boolean
  status?: boolean
  wol?: boolean
}

export type BusyById = Record<string, PcBusyState>
export type RowErrorById = Record<string, string>

export type UptimeBucket = 'day' | 'week' | 'month' | 'year'

export interface UptimeSummaryItem {
  label: string
  period_start: string
  period_end: string
  online_seconds: number
  online_ratio: number
}

export interface PcUptimeSummaryResponse {
  pc_id: string
  from: string
  to: string
  bucket: UptimeBucket
  tz: string
  items: UptimeSummaryItem[]
}

export interface UptimeWeeklyInterval {
  start: string
  end: string
  duration_seconds: number
}

export interface UptimeWeeklyDay {
  date: string
  online_seconds: number
  intervals: UptimeWeeklyInterval[]
}

export interface PcWeeklyTimelineResponse {
  pc_id: string
  week_start: string
  week_end: string
  tz: string
  days: UptimeWeeklyDay[]
}

export interface ApiToken {
  id: string
  name: string
  role: 'admin' | 'device'
  token_prefix: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}

export interface ApiTokenListResponse {
  items: ApiToken[]
}

export interface ApiTokenCreatePayload {
  name: string
  role?: 'admin' | 'device'
  expires_at: string | null
}

export interface ApiTokenCreateResponse {
  token: ApiToken
  plain_token: string
}

export interface ApiTokenRevokeResponse {
  token: ApiToken
}

export interface ApiTokenDeleteResponse {
  deleted_token_id: string
  deleted: boolean
}

export interface ApiActorMeResponse {
  token_id: string
  token_name: string
  token_role: 'admin' | 'device'
}
