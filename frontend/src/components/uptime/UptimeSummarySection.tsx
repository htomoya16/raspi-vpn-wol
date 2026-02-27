import type { CSSProperties, TouchEvent } from 'react'

import type { UptimeSummaryItem } from '../../types/models'
import LoadingDots from '../LoadingDots'
import type { SlideDirection, SummaryAxisTick, SummaryBucket } from './types'
import { formatSecondsToAxisHours, formatSecondsToHours, formatSummaryLabel } from './utils'

interface UptimeSummarySectionProps {
  isMobile: boolean
  dateRangeLabel: string
  summaryError: string
  summaryLoading: boolean
  summaryItems: UptimeSummaryItem[]
  summarySlide: SlideDirection
  summaryAxisTicks: SummaryAxisTick[]
  summaryAveragePercent: number
  summaryAverageSeconds: number
  summaryMaxSeconds: number
  summaryGridStyle: CSSProperties
  summaryBucket: SummaryBucket
  isSummaryNextDisabled: boolean
  onMoveSummary: (direction: 1 | -1) => void
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  onTouchCancel: () => void
}

function UptimeSummarySection({
  isMobile,
  dateRangeLabel,
  summaryError,
  summaryLoading,
  summaryItems,
  summarySlide,
  summaryAxisTicks,
  summaryAveragePercent,
  summaryAverageSeconds,
  summaryMaxSeconds,
  summaryGridStyle,
  summaryBucket,
  isSummaryNextDisabled,
  onMoveSummary,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
}: UptimeSummarySectionProps) {
  return (
    <section className="uptime-section">
      <header className="uptime-section__header uptime-section__header--with-nav">
        <div>
          <h3>オンライン集計グラフ</h3>
          <p>{dateRangeLabel}</p>
        </div>

        {!isMobile ? (
          <div className="uptime-nav uptime-nav--summary" aria-label="オンライン集計の移動">
            <button
              type="button"
              className="btn btn--soft uptime-nav__arrow"
              onClick={() => onMoveSummary(-1)}
              aria-label="オンライン集計を前へ"
            >
              <span className="uptime-nav__glyph" aria-hidden="true">
                {'<'}
              </span>
            </button>
            <button
              type="button"
              className="btn btn--soft uptime-nav__arrow"
              onClick={() => onMoveSummary(1)}
              disabled={isSummaryNextDisabled}
              aria-label="オンライン集計を次へ"
            >
              <span className="uptime-nav__glyph" aria-hidden="true">
                {'>'}
              </span>
            </button>
          </div>
        ) : null}
      </header>

      {!summaryLoading && summaryError ? <p className="feedback feedback--error">{summaryError}</p> : null}

      {!summaryError ? (
        <div
          className="uptime-section__content uptime-section__content--summary"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
        >
          {summaryItems.length > 0 ? (
            <div className={`uptime-slide-surface ${summarySlide ? `uptime-slide-surface--${summarySlide}` : ''}`}>
              <div className={`uptime-chart uptime-chart--${summaryBucket}`}>
                <div className="uptime-chart__axis" aria-hidden="true">
                  {summaryAxisTicks.map((tick) => (
                    <span
                      key={tick.key}
                      className={`uptime-chart__axis-label ${tick.isMin ? 'uptime-chart__axis-label--min' : ''} ${tick.isMax ? 'uptime-chart__axis-label--max' : ''}`.trim()}
                      style={{ top: `${(1 - tick.ratio) * 100}%` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>

                <div className="uptime-chart__main">
                  <div className="uptime-chart__scroller">
                    <div className="uptime-chart__plot">
                      <span className="uptime-chart__avg-line" style={{ bottom: `${summaryAveragePercent}%` }}>
                        <span className="uptime-chart__avg-label">
                          平均 {formatSecondsToAxisHours(summaryAverageSeconds)}
                        </span>
                      </span>

                      <div className="uptime-chart__bars" style={summaryGridStyle}>
                        {summaryItems.map((item, index) => (
                          <div key={`${item.period_start}-${item.period_end}`} className="uptime-chart__bar-cell">
                            <div className="uptime-chart__bar-wrap">
                              <div
                                className={`uptime-chart__bar ${
                                  summarySlide ? `uptime-chart__bar--grow uptime-chart__bar--grow-${summarySlide}` : ''
                                }`.trim()}
                                style={{
                                  height: `${item.online_seconds <= 0 ? 0 : Math.max((item.online_seconds / summaryMaxSeconds) * 100, 2)}%`,
                                  animationDelay: summarySlide ? `${Math.min(index, 24) * 22}ms` : undefined,
                                }}
                                title={`${item.label}: ${formatSecondsToHours(item.online_seconds)} (${Math.round(item.online_ratio * 100)}%)`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="uptime-chart__meta" style={summaryGridStyle}>
                      {summaryItems.map((item) => (
                        <div key={`meta-${item.period_start}-${item.period_end}`} className="uptime-chart__meta-item">
                          <p className="uptime-chart__label">{formatSummaryLabel(item, summaryBucket)}</p>
                          <p className="uptime-chart__value">{formatSecondsToHours(item.online_seconds)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="uptime-summary-placeholder">
              <p className="empty-state">集計データがありません。</p>
            </div>
          )}

          {summaryLoading ? (
            <div className="uptime-loading-overlay">
              <LoadingDots label="集計データを読み込み中です" />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default UptimeSummarySection
