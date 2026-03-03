import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CACHE_MAX_ENTRIES,
  clearApiCacheForTest,
  getCachedValue,
  setCachedValue,
} from './cache'

describe('api cache store', () => {
  afterEach(() => {
    clearApiCacheForTest()
    vi.restoreAllMocks()
  })

  it('evicts oldest entry when max entries exceeded', () => {
    for (let i = 0; i < CACHE_MAX_ENTRIES; i += 1) {
      setCachedValue(`key-${i}`, { idx: i }, 60_000)
    }

    setCachedValue(`key-${CACHE_MAX_ENTRIES}`, { idx: CACHE_MAX_ENTRIES }, 60_000)

    expect(getCachedValue<{ idx: number }>('key-0')).toBeNull()
    expect(getCachedValue<{ idx: number }>(`key-${CACHE_MAX_ENTRIES}`)).toEqual({
      idx: CACHE_MAX_ENTRIES,
    })
  })

  it('sweeps expired entries periodically', () => {
    const dateNow = vi.spyOn(Date, 'now')
    dateNow.mockReturnValue(1_000)
    setCachedValue('expired-key', { ok: true }, 10)
    expect(getCachedValue<{ ok: boolean }>('expired-key')).toEqual({ ok: true })

    dateNow.mockReturnValue(62_000)
    setCachedValue('fresh-key', { ok: true }, 10_000)

    expect(getCachedValue<{ ok: boolean }>('expired-key')).toBeNull()
    expect(getCachedValue<{ ok: boolean }>('fresh-key')).toEqual({ ok: true })
  })
})
