import { describe, expect, it } from 'vitest'

import { toQueryString } from './query'

describe('toQueryString', () => {
  it('builds query string and skips empty values', () => {
    expect(
      toQueryString({
        q: 'pc main',
        status: 'online',
        limit: 200,
        cursor: '',
        tag: null,
      }),
    ).toBe('?q=pc+main&status=online&limit=200')
  })

  it('returns empty string when no effective params exist', () => {
    expect(
      toQueryString({
        q: '',
        status: undefined,
        tag: null,
      }),
    ).toBe('')
  })
})
