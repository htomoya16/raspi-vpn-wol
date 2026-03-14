import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PcFilterState, TrackedJob } from '../../types/models'
import { createPcFactory } from '../../test/factories'
import type { DashboardWorkspaceData } from './types'
import MobileWorkspace from './MobileWorkspace'

vi.mock('../PcList', () => ({
  default: () => <div>Mock PcList</div>,
}))
vi.mock('../PcForm', () => ({
  default: () => <div>Mock PcForm</div>,
}))
vi.mock('../JobQueue', () => ({
  default: () => <div>Mock JobQueue</div>,
}))
vi.mock('../LogsPanel', () => ({
  default: () => <div>Mock LogsPanel</div>,
}))
vi.mock('../UptimePanel', () => ({
  default: () => <div>Mock UptimePanel</div>,
}))
vi.mock('../SettingsDialog', () => ({
  SettingsPanel: () => <div>Mock SettingsPanel</div>,
}))

const defaultFilters: PcFilterState = { q: '', status: '' }

function createDashboardData(): DashboardWorkspaceData {
  return {
    pcListProps: {
      items: [createPcFactory()],
      loading: false,
      error: '',
      filters: defaultFilters,
      appliedFilters: defaultFilters,
      onFilterChange: vi.fn(),
      onApplyFilters: vi.fn(),
      onClearFilters: vi.fn(),
      onReload: vi.fn(),
      onRefreshStatus: vi.fn(),
      onSendWol: vi.fn(),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onUpdate: vi.fn().mockResolvedValue(createPcFactory()),
      onSelectPc: vi.fn(),
      busyById: {},
      rowErrorById: {},
      lastSyncedAt: '2026-03-01T00:00:00Z',
    },
    createLoading: false,
    createError: '',
    onCreatePc: vi.fn().mockResolvedValue(true),
    jobs: [] as TrackedJob[],
    logsPanelProps: {
      items: [],
      loading: false,
      error: '',
      onReload: vi.fn(),
      onClear: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('MobileWorkspace', () => {
  it('renders bottom nav entries in expected order and changes view on tap', async () => {
    const user = userEvent.setup()
    const onChangeMobileView = vi.fn()

    render(
      <MobileWorkspace
        mobileView="pcs"
        onChangeMobileView={onChangeMobileView}
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="light"
        themeOptions={[
          { id: 'default', label: 'デフォルト', primary: '#111', primaryStrong: '#000', accent: '#fff' },
        ]}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
        dashboard={createDashboardData()}
        pcs={[createPcFactory()]}
        selectedPcId="pc-main"
        onSelectPc={vi.fn()}
      />,
    )

    const nav = screen.getByRole('navigation', { name: '表示切替メニュー' })
    const buttons = within(nav).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label') || button.textContent?.trim())).toEqual([
      'PC一覧',
      'ログ',
      'PC登録',
      '稼働時間',
      '設定',
    ])

    await user.click(within(nav).getByRole('button', { name: '設定' }))
    expect(onChangeMobileView).toHaveBeenCalledWith('settings')
  })

  it('shows settings content when mobileView is settings', () => {
    render(
      <MobileWorkspace
        mobileView="settings"
        onChangeMobileView={vi.fn()}
        selectedThemeId="default"
        appearanceMode="system"
        effectiveAppearanceMode="dark"
        themeOptions={[
          { id: 'default', label: 'デフォルト', primary: '#111', primaryStrong: '#000', accent: '#fff' },
        ]}
        onThemeChange={vi.fn()}
        onAppearanceChange={vi.fn()}
        dashboard={createDashboardData()}
        pcs={[createPcFactory()]}
        selectedPcId="pc-main"
        onSelectPc={vi.fn()}
      />,
    )

    expect(screen.getByText('Mock SettingsPanel')).toBeInTheDocument()
  })

  it('scrolls to top when logs nav button is tapped', async () => {
    const user = userEvent.setup()
    const onChangeMobileView = vi.fn()
    const originalScrollTo = window.scrollTo
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const scrollToMock = vi.fn()

    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: scrollToMock,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })

    try {
      render(
        <MobileWorkspace
          mobileView="pcs"
          onChangeMobileView={onChangeMobileView}
          selectedThemeId="default"
          appearanceMode="system"
          effectiveAppearanceMode="light"
          themeOptions={[
            { id: 'default', label: 'デフォルト', primary: '#111', primaryStrong: '#000', accent: '#fff' },
          ]}
          onThemeChange={vi.fn()}
          onAppearanceChange={vi.fn()}
          dashboard={createDashboardData()}
          pcs={[createPcFactory()]}
          selectedPcId="pc-main"
          onSelectPc={vi.fn()}
        />,
      )

      const nav = screen.getByRole('navigation', { name: '表示切替メニュー' })
      await user.click(within(nav).getByRole('button', { name: 'ログ' }))

      expect(onChangeMobileView).toHaveBeenCalledWith('logs')
      await waitFor(() => {
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
      })
    } finally {
      Object.defineProperty(window, 'scrollTo', {
        writable: true,
        value: originalScrollTo,
      })
      Object.defineProperty(window, 'requestAnimationFrame', {
        writable: true,
        value: originalRequestAnimationFrame,
      })
    }
  })
})
