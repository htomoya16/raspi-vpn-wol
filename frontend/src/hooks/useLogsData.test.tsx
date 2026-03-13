import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearLogs, listLogs } from '../api/logs'
import { createLogEntryFactory } from '../test/factories'
import type { LogListResponse } from '../types/models'
import { useLogsData } from './useLogsData'

vi.mock('../api/logs', () => ({
  listLogs: vi.fn(),
  clearLogs: vi.fn(),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useLogsData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets loadingMore when loadLogs supersedes in-flight loadMore', async () => {
    const firstLoad = createDeferred<LogListResponse>()
    const pendingLoadMore = createDeferred<LogListResponse>()
    const reload = createDeferred<LogListResponse>()
    const listLogsMock = vi.mocked(listLogs)
    listLogsMock
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(pendingLoadMore.promise)
      .mockReturnValueOnce(reload.promise)

    const setNotice = vi.fn()
    const { result } = renderHook(() => useLogsData({ setNotice }))

    let initialLoadPromise!: Promise<void>
    act(() => {
      initialLoadPromise = result.current.loadLogs()
    })

    firstLoad.resolve({
      items: [createLogEntryFactory({ id: 300 })],
      next_cursor: 299,
    })

    await act(async () => {
      await initialLoadPromise
    })

    let loadMorePromise!: Promise<void>
    act(() => {
      loadMorePromise = result.current.loadMoreLogs()
    })

    await waitFor(() => {
      expect(result.current.logsLoadingMore).toBe(true)
    })

    let reloadPromise!: Promise<void>
    act(() => {
      reloadPromise = result.current.loadLogs()
    })

    await waitFor(() => {
      expect(result.current.logsLoadingMore).toBe(false)
    })

    pendingLoadMore.resolve({
      items: [createLogEntryFactory({ id: 299 })],
      next_cursor: 298,
    })
    reload.resolve({
      items: [createLogEntryFactory({ id: 301 })],
      next_cursor: null,
    })

    await act(async () => {
      await Promise.all([loadMorePromise, reloadPromise])
    })

    expect(result.current.logsLoadingMore).toBe(false)
    expect(result.current.logs.map((item) => item.id)).toEqual([301])
    expect(result.current.logsHasMore).toBe(false)
  })

  it('keeps loadingMore true while newer loadMore is still in flight', async () => {
    const firstLoad = createDeferred<LogListResponse>()
    const staleLoadMore = createDeferred<LogListResponse>()
    const reload = createDeferred<LogListResponse>()
    const activeLoadMore = createDeferred<LogListResponse>()
    const listLogsMock = vi.mocked(listLogs)
    listLogsMock
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(staleLoadMore.promise)
      .mockReturnValueOnce(reload.promise)
      .mockReturnValueOnce(activeLoadMore.promise)

    const setNotice = vi.fn()
    const { result } = renderHook(() => useLogsData({ setNotice }))

    let initialLoadPromise!: Promise<void>
    act(() => {
      initialLoadPromise = result.current.loadLogs()
    })

    firstLoad.resolve({
      items: [createLogEntryFactory({ id: 410 })],
      next_cursor: 409,
    })
    await act(async () => {
      await initialLoadPromise
    })

    let staleLoadMorePromise!: Promise<void>
    act(() => {
      staleLoadMorePromise = result.current.loadMoreLogs()
    })
    await waitFor(() => {
      expect(result.current.logsLoadingMore).toBe(true)
    })

    let reloadPromise!: Promise<void>
    act(() => {
      reloadPromise = result.current.loadLogs()
    })
    reload.resolve({
      items: [createLogEntryFactory({ id: 420 })],
      next_cursor: 419,
    })
    await act(async () => {
      await reloadPromise
    })

    let activeLoadMorePromise!: Promise<void>
    act(() => {
      activeLoadMorePromise = result.current.loadMoreLogs()
    })
    await waitFor(() => {
      expect(result.current.logsLoadingMore).toBe(true)
    })

    staleLoadMore.resolve({
      items: [createLogEntryFactory({ id: 409 })],
      next_cursor: 408,
    })
    await act(async () => {
      await staleLoadMorePromise
    })

    expect(result.current.logsLoadingMore).toBe(true)

    activeLoadMore.resolve({
      items: [createLogEntryFactory({ id: 419 })],
      next_cursor: null,
    })
    await act(async () => {
      await activeLoadMorePromise
    })

    expect(result.current.logsLoadingMore).toBe(false)
    expect(result.current.logs.map((item) => item.id)).toEqual([420, 419])
  })

  it('resets loadingMore when clear action supersedes in-flight loadMore', async () => {
    const firstLoad = createDeferred<LogListResponse>()
    const pendingLoadMore = createDeferred<LogListResponse>()
    const listLogsMock = vi.mocked(listLogs)
    const clearLogsMock = vi.mocked(clearLogs)
    listLogsMock.mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(pendingLoadMore.promise)
    clearLogsMock.mockResolvedValueOnce({ deleted: 10 })

    const setNotice = vi.fn()
    const { result } = renderHook(() => useLogsData({ setNotice }))

    let initialLoadPromise!: Promise<void>
    act(() => {
      initialLoadPromise = result.current.loadLogs()
    })

    firstLoad.resolve({
      items: [createLogEntryFactory({ id: 200 })],
      next_cursor: 199,
    })

    await act(async () => {
      await initialLoadPromise
    })

    let loadMorePromise!: Promise<void>
    act(() => {
      loadMorePromise = result.current.loadMoreLogs()
    })

    await waitFor(() => {
      expect(result.current.logsLoadingMore).toBe(true)
    })

    await act(async () => {
      await result.current.clearLogsEntry()
    })

    expect(result.current.logsLoadingMore).toBe(false)
    expect(result.current.logs).toEqual([])
    expect(result.current.logsHasMore).toBe(false)

    pendingLoadMore.resolve({
      items: [createLogEntryFactory({ id: 199 })],
      next_cursor: null,
    })

    await act(async () => {
      await loadMorePromise
    })

    expect(result.current.logsLoadingMore).toBe(false)
    expect(setNotice).toHaveBeenCalledWith('ログを削除しました: 10件')
  })
})
