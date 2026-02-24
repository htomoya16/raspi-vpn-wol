import { describe, expect, it } from 'vitest'

import type { Pc } from '../../types/models'
import { parseTags, toEditForm, toUpdatePayload } from './utils'

function createPc(overrides: Partial<Pc> = {}): Pc {
  return {
    id: 'pc-1',
    name: 'Main PC',
    mac: 'AA:BB:CC:DD:EE:FF',
    ip: '192.168.10.10',
    tags: ['desk', 'home'],
    note: 'memo',
    status: 'unknown',
    last_seen_at: null,
    created_at: '2026-02-24T00:00:00Z',
    updated_at: '2026-02-24T00:00:00Z',
    ...overrides,
  }
}

describe('pc-list utils', () => {
  it('converts pc model to editable form', () => {
    const form = toEditForm(createPc())
    expect(form).toEqual({
      name: 'Main PC',
      mac: 'AA:BB:CC:DD:EE:FF',
      ip: '192.168.10.10',
      tags: 'desk, home',
      note: 'memo',
    })
  })

  it('parses tags with trim and empty removal', () => {
    expect(parseTags(' desk, ,home,lab ')).toEqual(['desk', 'home', 'lab'])
  })

  it('builds update payload with null normalization', () => {
    const payload = toUpdatePayload({
      name: ' Main PC ',
      mac: ' AA:BB:CC:DD:EE:FF ',
      ip: ' ',
      tags: 'desk,home',
      note: ' ',
    })

    expect(payload).toEqual({
      name: 'Main PC',
      mac: 'AA:BB:CC:DD:EE:FF',
      ip: null,
      tags: ['desk', 'home'],
      note: null,
    })
  })
})
