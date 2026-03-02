import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { invalidateLogsCache } from '../api/logs'
import { invalidatePcsAndUptimeCache } from '../api/pcs'
import { useDashboardData } from './useDashboardData'

const openEventsMock = vi.fn()
const useLogsDataMock = vi.fn()
const usePcDataMock = vi.fn()
const useJobTrackerMock = vi.fn()

vi.mock('../api/events', () => ({
  openEvents: () => openEventsMock(),
}))

vi.mock('../api/logs', () => ({
  invalidateLogsCache: vi.fn(),
  listLogs: vi.fn(),
  clearLogs: vi.fn(),
}))

vi.mock('../api/pcs', () => ({
  invalidatePcsAndUptimeCache: vi.fn(),
  refreshAllStatuses: vi.fn(),
  sendPcWol: vi.fn(),
}))

vi.mock('./useLogsData', () => ({
  useLogsData: (...args: unknown[]) => useLogsDataMock(...args),
}))

vi.mock('./usePcData', () => ({
  usePcData: (...args: unknown[]) => usePcDataMock(...args),
}))

vi.mock('./useJobTracker', () => ({
  useJobTracker: (...args: unknown[]) => useJobTrackerMock(...args),
}))

class EventSourceStub {
  private listeners = new Map<string, (event: Event) => void>()
  close = vi.fn()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener === 'function') {
      this.listeners.set(type, listener as (event: Event) => void)
      return
    }
    this.listeners.set(type, (event: Event) => listener.handleEvent(event))
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type)
  }

  emitJson(type: string, payload: unknown): void {
    const listener = this.listeners.get(type)
    if (!listener) {
      return
    }
    listener(new MessageEvent(type, { data: JSON.stringify(payload) }))
  }
}

describe('useDashboardData SSE cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates related caches on pc_status event', async () => {
    const source = new EventSourceStub()
    const loadLogs = vi.fn().mockResolvedValue(undefined)
    const loadPcs = vi.fn().mockResolvedValue(undefined)
    const applyPcStatusEvent = vi.fn()

    openEventsMock.mockReturnValue(source as unknown as EventSource)
    useLogsDataMock.mockReturnValue({
      logs: [],
      logsLoading: false,
      logsError: '',
      loadLogs,
      clearLogsEntry: vi.fn().mockResolvedValue(undefined),
    })
    usePcDataMock.mockReturnValue({
      pcs: [],
      pcLoading: false,
      pcError: '',
      pcFilters: { q: '', status: '' },
      appliedPcFilters: { q: '', status: '' },
      createLoading: false,
      createError: '',
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '',
      onlineCount: 0,
      loadPcs,
      setBusy: vi.fn(),
      setPcError: vi.fn(),
      setRowError: vi.fn(),
      createPcEntry: vi.fn(),
      deletePcEntry: vi.fn(),
      updatePcEntry: vi.fn(),
      refreshPcStatusEntry: vi.fn(),
      applyPcStatusEvent,
      setPcStatusLocal: vi.fn(),
      handleFilterChange: vi.fn(),
      handleApplyFilters: vi.fn(),
      handleClearFilters: vi.fn(),
    })
    useJobTrackerMock.mockReturnValue({
      jobs: [],
      trackJob: vi.fn().mockResolvedValue(undefined),
    })

    renderHook(() => useDashboardData())

    vi.clearAllMocks()
    await act(async () => {
      source.emitJson('pc_status', {
        pc_id: 'pc-main',
        status: 'online',
        updated_at: '2026-02-28T12:00:00+09:00',
        last_seen_at: '2026-02-28T11:59:00+09:00',
      })
    })

    expect(applyPcStatusEvent).toHaveBeenCalledWith(
      'pc-main',
      'online',
      '2026-02-28T12:00:00+09:00',
      '2026-02-28T11:59:00+09:00',
    )
    expect(invalidatePcsAndUptimeCache).toHaveBeenCalledWith('pc-main')
    expect(invalidateLogsCache).toHaveBeenCalledTimes(1)
    expect(loadLogs).toHaveBeenCalledTimes(1)
    expect(loadPcs).not.toHaveBeenCalled()
  })

  it('does not reload on non-terminal job event', async () => {
    const source = new EventSourceStub()
    const loadLogs = vi.fn().mockResolvedValue(undefined)
    const loadPcs = vi.fn().mockResolvedValue(undefined)

    openEventsMock.mockReturnValue(source as unknown as EventSource)
    useLogsDataMock.mockReturnValue({
      logs: [],
      logsLoading: false,
      logsError: '',
      loadLogs,
      clearLogsEntry: vi.fn().mockResolvedValue(undefined),
    })
    usePcDataMock.mockReturnValue({
      pcs: [],
      pcLoading: false,
      pcError: '',
      pcFilters: { q: '', status: '' },
      appliedPcFilters: { q: '', status: '' },
      createLoading: false,
      createError: '',
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '',
      onlineCount: 0,
      loadPcs,
      setBusy: vi.fn(),
      setPcError: vi.fn(),
      setRowError: vi.fn(),
      createPcEntry: vi.fn(),
      deletePcEntry: vi.fn(),
      updatePcEntry: vi.fn(),
      refreshPcStatusEntry: vi.fn(),
      applyPcStatusEvent: vi.fn(),
      setPcStatusLocal: vi.fn(),
      handleFilterChange: vi.fn(),
      handleApplyFilters: vi.fn(),
      handleClearFilters: vi.fn(),
    })
    useJobTrackerMock.mockReturnValue({
      jobs: [],
      trackJob: vi.fn().mockResolvedValue(undefined),
    })

    renderHook(() => useDashboardData())

    vi.clearAllMocks()
    await act(async () => {
      source.emitJson('job', { id: 'job-1', state: 'running' })
    })

    expect(invalidatePcsAndUptimeCache).not.toHaveBeenCalled()
    expect(invalidateLogsCache).not.toHaveBeenCalled()
    expect(loadPcs).not.toHaveBeenCalled()
    expect(loadLogs).not.toHaveBeenCalled()
  })

  it('uses per-pc invalidate when terminal job event contains pc_id in payload', async () => {
    const source = new EventSourceStub()
    const loadLogs = vi.fn().mockResolvedValue(undefined)
    const loadPcs = vi.fn().mockResolvedValue(undefined)

    openEventsMock.mockReturnValue(source as unknown as EventSource)
    useLogsDataMock.mockReturnValue({
      logs: [],
      logsLoading: false,
      logsError: '',
      loadLogs,
      clearLogsEntry: vi.fn().mockResolvedValue(undefined),
    })
    usePcDataMock.mockReturnValue({
      pcs: [],
      pcLoading: false,
      pcError: '',
      pcFilters: { q: '', status: '' },
      appliedPcFilters: { q: '', status: '' },
      createLoading: false,
      createError: '',
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '',
      onlineCount: 0,
      loadPcs,
      setBusy: vi.fn(),
      setPcError: vi.fn(),
      setRowError: vi.fn(),
      createPcEntry: vi.fn(),
      deletePcEntry: vi.fn(),
      updatePcEntry: vi.fn(),
      refreshPcStatusEntry: vi.fn(),
      applyPcStatusEvent: vi.fn(),
      setPcStatusLocal: vi.fn(),
      handleFilterChange: vi.fn(),
      handleApplyFilters: vi.fn(),
      handleClearFilters: vi.fn(),
    })
    useJobTrackerMock.mockReturnValue({
      jobs: [],
      trackJob: vi.fn().mockResolvedValue(undefined),
    })

    renderHook(() => useDashboardData())

    vi.clearAllMocks()
    await act(async () => {
      source.emitJson('job', {
        id: 'job-1',
        state: 'failed',
        payload: {
          pc_id: 'pc-sub',
        },
      })
    })

    expect(invalidatePcsAndUptimeCache).toHaveBeenCalledWith('pc-sub')
    expect(invalidateLogsCache).toHaveBeenCalledTimes(1)
    expect(loadPcs).toHaveBeenCalledTimes(1)
    expect(loadLogs).toHaveBeenCalledTimes(1)
  })

  it('does not load api resources when disabled', () => {
    const loadLogs = vi.fn().mockResolvedValue(undefined)
    const loadPcs = vi.fn().mockResolvedValue(undefined)

    openEventsMock.mockReturnValue(new EventSourceStub() as unknown as EventSource)
    useLogsDataMock.mockReturnValue({
      logs: [],
      logsLoading: false,
      logsError: '',
      loadLogs,
      clearLogsEntry: vi.fn().mockResolvedValue(undefined),
    })
    usePcDataMock.mockReturnValue({
      pcs: [],
      pcLoading: false,
      pcError: '',
      pcFilters: { q: '', status: '' },
      appliedPcFilters: { q: '', status: '' },
      createLoading: false,
      createError: '',
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '',
      onlineCount: 0,
      loadPcs,
      setBusy: vi.fn(),
      setPcError: vi.fn(),
      setRowError: vi.fn(),
      createPcEntry: vi.fn(),
      deletePcEntry: vi.fn(),
      updatePcEntry: vi.fn(),
      refreshPcStatusEntry: vi.fn(),
      applyPcStatusEvent: vi.fn(),
      setPcStatusLocal: vi.fn(),
      handleFilterChange: vi.fn(),
      handleApplyFilters: vi.fn(),
      handleClearFilters: vi.fn(),
    })
    useJobTrackerMock.mockReturnValue({
      jobs: [],
      trackJob: vi.fn().mockResolvedValue(undefined),
    })

    renderHook(() => useDashboardData({ enabled: false }))

    expect(loadLogs).not.toHaveBeenCalled()
    expect(loadPcs).not.toHaveBeenCalled()
    expect(openEventsMock).not.toHaveBeenCalled()
  })

  it('invalidates caches when job tracker requests progress or terminal refresh', async () => {
    const loadLogs = vi.fn().mockResolvedValue(undefined)
    const loadPcs = vi.fn().mockResolvedValue(undefined)
    let trackerParams: { onTerminal: () => Promise<void>; onProgress?: () => Promise<void> } | null = null

    openEventsMock.mockReturnValue(null)
    useLogsDataMock.mockReturnValue({
      logs: [],
      logsLoading: false,
      logsError: '',
      loadLogs,
      clearLogsEntry: vi.fn().mockResolvedValue(undefined),
    })
    usePcDataMock.mockReturnValue({
      pcs: [],
      pcLoading: false,
      pcError: '',
      pcFilters: { q: '', status: '' },
      appliedPcFilters: { q: '', status: '' },
      createLoading: false,
      createError: '',
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '',
      onlineCount: 0,
      loadPcs,
      setBusy: vi.fn(),
      setPcError: vi.fn(),
      setRowError: vi.fn(),
      createPcEntry: vi.fn(),
      deletePcEntry: vi.fn(),
      updatePcEntry: vi.fn(),
      refreshPcStatusEntry: vi.fn(),
      applyPcStatusEvent: vi.fn(),
      setPcStatusLocal: vi.fn(),
      handleFilterChange: vi.fn(),
      handleApplyFilters: vi.fn(),
      handleClearFilters: vi.fn(),
    })
    useJobTrackerMock.mockImplementation((params) => {
      trackerParams = params as { onTerminal: () => Promise<void>; onProgress?: () => Promise<void> }
      return {
        jobs: [],
        trackJob: vi.fn().mockResolvedValue(undefined),
      }
    })

    renderHook(() => useDashboardData())
    expect(trackerParams).not.toBeNull()

    vi.clearAllMocks()
    await act(async () => {
      await trackerParams?.onProgress?.()
    })
    expect(invalidateLogsCache).toHaveBeenCalledTimes(1)
    expect(invalidatePcsAndUptimeCache).not.toHaveBeenCalled()
    expect(loadLogs).toHaveBeenCalledTimes(1)
    expect(loadPcs).not.toHaveBeenCalled()

    vi.clearAllMocks()
    await act(async () => {
      await trackerParams?.onTerminal()
    })
    expect(invalidatePcsAndUptimeCache).toHaveBeenCalledWith()
    expect(invalidateLogsCache).toHaveBeenCalledTimes(1)
    expect(loadPcs).toHaveBeenCalledTimes(1)
    expect(loadLogs).toHaveBeenCalledTimes(1)
  })
})
