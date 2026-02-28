import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Pc, PcFilterState } from '../types/models'
import PcList, { type PcListProps } from './PcList'

function createPc(overrides: Partial<Pc> = {}): Pc {
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

function renderPcList(overrides: Partial<PcListProps> = {}) {
  const filters: PcFilterState = { q: '', status: '' }
  const baseProps: PcListProps = {
    items: [createPc()],
    loading: false,
    error: '',
    filters,
    appliedFilters: filters,
    onFilterChange: vi.fn(),
    onApplyFilters: vi.fn(),
    onClearFilters: vi.fn(),
    onReload: vi.fn(),
    onRefreshStatus: vi.fn(),
    onSendWol: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockImplementation(async () => createPc()),
    busyById: {},
    rowErrorById: {},
    lastSyncedAt: '2026-02-24T00:00:00Z',
    ...overrides,
  }

  render(<PcList {...baseProps} />)
  return baseProps
}

describe('PcList', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows empty-state message when no pc exists', () => {
    renderPcList({ items: [] })
    expect(screen.getByText('PCがまだ登録されていません。')).toBeInTheDocument()
  })

  it('shows filtered empty-state message when filters are active', () => {
    renderPcList({
      items: [],
      appliedFilters: { q: 'pc-1', status: '' },
    })
    expect(screen.getByText('該当するPCがありません。')).toBeInTheDocument()
  })

  it('keeps list layout while loading without showing blocking overlay', () => {
    renderPcList({ loading: true })
    expect(screen.getByText('Main PC')).toBeInTheDocument()
    expect(screen.queryByText(/PC一覧を読み込み中/)).not.toBeInTheDocument()
  })

  it('opens detail dialog when row is tapped', async () => {
    const user = userEvent.setup()
    renderPcList()

    await user.click(screen.getByText('Main PC'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('MAC')).toBeInTheDocument()
  })

  it('shows validation message when editing with empty required fields', async () => {
    const user = userEvent.setup()
    renderPcList()

    await user.click(screen.getByText('Main PC'))
    await user.click(screen.getByRole('button', { name: '編集' }))

    const nameInput = screen.getByLabelText(/表示名/)
    await user.clear(nameInput)
    expect(nameInput).toHaveValue('')

    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText(/表示名・MACアドレス・IPアドレスは必須です。/)).toBeInTheDocument()
  })

  it('opens delete confirmation and calls delete handler', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderPcList({ onDelete })

    await user.click(screen.getByText('Main PC'))
    await user.click(screen.getByRole('button', { name: '削除' }))
    expect(screen.getByText('PCを削除しますか？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('pc-1'))
  })
})
