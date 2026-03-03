import { describe, expect, it } from 'vitest'

import { formatJstDateParts, formatJstDateTime, parseDate } from './datetime'

describe('datetime utils', () => {
  it('parses naive datetime as UTC', () => {
    const date = parseDate('2026-02-24 03:00:00')
    expect(date).not.toBeNull()
    expect(date?.toISOString()).toBe('2026-02-24T03:00:00.000Z')
  })

  it('returns null for blank values', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
  })

  it('formats JST datetime with fallback', () => {
    expect(formatJstDateTime(null, { fallback: '未同期' })).toBe('未同期')
    expect(formatJstDateTime('2026-02-24T00:00:00Z')).toContain('2026')
  })

  it('extracts JST date/time parts', () => {
    const parts = formatJstDateParts('2026-02-24T00:00:00Z')
    expect(parts.date).toContain('2026')
    expect(parts.time).toMatch(/9:00:00|09:00:00/)
  })

  it('returns fallback parts for invalid date', () => {
    const parts = formatJstDateParts('invalid-date', {
      fallbackDate: 'N/A',
      fallbackTime: '-',
    })
    expect(parts).toEqual({ date: 'invalid-date', time: '-' })
  })
})
