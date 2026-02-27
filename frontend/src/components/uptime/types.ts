import type { UptimeWeeklyInterval } from '../../types/models'

export type SummaryBucket = 'day' | 'month' | 'year'
export type SlideDirection = 'prev' | 'next' | null
export type IntervalDisplayMode = 'full' | 'compact' | 'minimal'

export interface TimelineInterval extends UptimeWeeklyInterval {
  key: string
}

export interface TimelineDay {
  date: string
  online_seconds: number
  intervals: TimelineInterval[]
}

export interface SummaryAxisTick {
  key: string
  ratio: number
  value: number
  label: string
  isMin: boolean
  isMax: boolean
}
