import { useDelayedVisibility } from '../../hooks/useDelayedVisibility'
import type { PcFilterState } from '../../types/models'
import LoadingDots from '../LoadingDots'
import LoadingSpinner from '../LoadingSpinner'

interface PcListFiltersProps {
  isMobile: boolean
  showFilters: boolean
  loading: boolean
  filters: PcFilterState
  onToggleFilters: () => void
  onFilterChange: (key: keyof PcFilterState, value: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onReload: () => Promise<void> | void
  showInitialLoading: boolean
}

function PcListFilters({
  isMobile,
  showFilters,
  loading,
  filters,
  onToggleFilters,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onReload,
  showInitialLoading,
}: PcListFiltersProps) {
  const showRefreshingSpinner = useDelayedVisibility(loading && !showInitialLoading, 200)

  return (
    <div className="pc-filters-shell">
      {isMobile ? (
        <button
          type="button"
          className="btn btn--soft pc-filters-toggle"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
        >
          {showFilters ? '絞り込みを非表示' : '絞り込みを表示'}
        </button>
      ) : null}

      {!isMobile || showFilters ? (
        <div className="pc-filters">
          <label>
            検索
            <input
              type="text"
              value={filters.q}
              onChange={(event) => onFilterChange('q', event.target.value)}
              placeholder="名前 / ID / MAC"
            />
          </label>

          <label>
            ステータス
            <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
              <option value="">すべて</option>
              <option value="online">online</option>
              <option value="offline">offline</option>
              <option value="unknown">unknown</option>
              <option value="booting">booting</option>
              <option value="unreachable">unreachable</option>
            </select>
          </label>

          <button type="button" className="btn btn--primary" onClick={onApplyFilters}>
            適用
          </button>
          <button type="button" className="btn btn--soft" onClick={onClearFilters}>
            クリア
          </button>
          <button type="button" className="btn btn--soft" onClick={onReload} disabled={loading}>
            {showInitialLoading ? (
              <LoadingDots label="読み込み中" />
            ) : (
              <span className="btn__with-spinner">
                {showRefreshingSpinner ? <LoadingSpinner ariaLabel="PC一覧を更新中です" /> : null}
                <span>再読み込み</span>
              </span>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default PcListFilters
