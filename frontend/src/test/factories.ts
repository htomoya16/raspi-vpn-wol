import type { LogEntry, Pc } from '../types/models'

export function createPcFactory(overrides: Partial<Pc> = {}): Pc {
  return {
    id: 'pc-1',
    name: 'Main PC',
    mac: 'AA:BB:CC:DD:EE:FF',
    ip: '192.168.10.10',
    tags: ['desk'],
    note: 'main machine',
    status: 'online',
    last_seen_at: '2026-02-24T00:00:00Z',
    created_at: '2026-02-24T00:00:00Z',
    updated_at: '2026-02-24T00:00:00Z',
    ...overrides,
  }
}

export function createLogEntryFactory(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    pc_id: 'pc-1',
    action: 'status',
    event_kind: 'normal',
    ok: true,
    message: 'status checked',
    details: { source: 'manual' },
    created_at: '2026-02-24T00:00:00Z',
    ...overrides,
  }
}
