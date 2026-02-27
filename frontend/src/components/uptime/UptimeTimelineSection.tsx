import type { TouchEvent } from 'react'

import type { PcWeeklyTimelineResponse } from '../../types/models'
import LoadingDots from '../LoadingDots'
import type { SlideDirection, TimelineDay } from './types'
import { formatSecondsToHours, formatWeekDayLabel, getIntervalDisplayMode, intervalToVertical } from './utils'

interface UptimeTimelineSectionProps {
  isMobile: boolean
  weeklyData: PcWeeklyTimelineResponse
  visibleTimelineDays: TimelineDay[]
  activeTimelineDay: TimelineDay | null
  weeklyLoading: boolean
  weeklyError: string
  weeklySlide: SlideDirection
  isTimelineNextDisabled: boolean
  hourMarkers: number[]
  onMoveTimeline: (direction: 1 | -1) => void
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  onTouchCancel: () => void
}

function UptimeTimelineSection({
  isMobile,
  weeklyData,
  visibleTimelineDays,
  activeTimelineDay,
  weeklyLoading,
  weeklyError,
  weeklySlide,
  isTimelineNextDisabled,
  hourMarkers,
  onMoveTimeline,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
}: UptimeTimelineSectionProps) {
  return (
    <section className="uptime-section">
      <header className="uptime-section__header uptime-section__header--with-nav">
        <div>
          <h3>稼働タイムライン</h3>
          <p>
            {isMobile && activeTimelineDay
              ? `${formatWeekDayLabel(activeTimelineDay.date)} / ${weeklyData.week_start} - ${weeklyData.week_end}`
              : `${weeklyData.week_start} - ${weeklyData.week_end}`}
          </p>
        </div>

        {!isMobile ? (
          <div className="uptime-nav uptime-nav--weekly" aria-label="稼働タイムラインの移動">
            <button
              type="button"
              className="btn btn--soft uptime-nav__arrow"
              onClick={() => onMoveTimeline(-1)}
              aria-label="稼働タイムラインを前へ"
            >
              <span className="uptime-nav__glyph" aria-hidden="true">
                {'<'}
              </span>
            </button>
            <button
              type="button"
              className="btn btn--soft uptime-nav__arrow"
              onClick={() => onMoveTimeline(1)}
              disabled={isTimelineNextDisabled}
              aria-label="稼働タイムラインを次へ"
            >
              <span className="uptime-nav__glyph" aria-hidden="true">
                {'>'}
              </span>
            </button>
          </div>
        ) : null}
      </header>

      {!weeklyLoading && weeklyError ? <p className="feedback feedback--error">{weeklyError}</p> : null}

      {!weeklyError ? (
        <div
          className="uptime-section__content uptime-section__content--weekly"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
        >
          <div className={`uptime-slide-surface ${weeklySlide ? `uptime-slide-surface--${weeklySlide}` : ''}`}>
            <div
              className={`uptime-week-calendar ${isMobile ? 'uptime-week-calendar--single-day' : ''} ${
                weeklySlide ? `uptime-week-calendar--expand-${weeklySlide}` : ''
              }`}
            >
              <div className="uptime-week-calendar__head">
                <div className="uptime-week-calendar__axis-spacer" />
                {visibleTimelineDays.map((day) => (
                  <div key={`head-${day.date}`} className="uptime-week-calendar__day-head">
                    <p>{formatWeekDayLabel(day.date)}</p>
                    <span>{formatSecondsToHours(day.online_seconds)}</span>
                  </div>
                ))}
              </div>

              <div className="uptime-week-calendar__body">
                <div className="uptime-week-calendar__axis">
                  {hourMarkers.map((hour) => (
                    <span
                      key={`axis-${hour}`}
                      className={`uptime-week-calendar__axis-label ${
                        hour === 0
                          ? 'uptime-week-calendar__axis-label--start'
                          : hour === 24
                            ? 'uptime-week-calendar__axis-label--end'
                            : 'uptime-week-calendar__axis-label--hourly'
                      }`.trim()}
                      style={{ top: `${(hour / 24) * 100}%` }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>

                <div className="uptime-week-calendar__columns">
                  {visibleTimelineDays.map((day) => (
                    <div key={day.date} className="uptime-week-calendar__column">
                      {Array.from({ length: 23 }).map((_, index) => (
                        <span
                          key={`${day.date}-${index}`}
                          className="uptime-week-calendar__hour-line"
                          style={{ top: `${((index + 1) / 24) * 100}%` }}
                        />
                      ))}
                      {day.intervals.map((interval) => {
                        const position = intervalToVertical(interval)
                        const mode = getIntervalDisplayMode(interval.duration_seconds)
                        return (
                          <span
                            key={interval.key}
                            className={`uptime-week-calendar__event uptime-week-calendar__event--${mode}`}
                            style={{
                              top: `${position.top}%`,
                              height: `${position.height}%`,
                            }}
                            title={`${day.date} ${interval.start} - ${interval.end} (${formatSecondsToHours(interval.duration_seconds)})`}
                          >
                            {mode === 'full' ? (
                              <>
                                <span className="uptime-week-calendar__event-start">{interval.start}</span>
                                <span className="uptime-week-calendar__event-end">{interval.end}</span>
                              </>
                            ) : null}
                            {mode === 'compact' ? (
                              <span className="uptime-week-calendar__event-range">
                                {interval.start} - {interval.end}
                              </span>
                            ) : null}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {weeklyLoading ? (
            <div className="uptime-loading-overlay">
              <LoadingDots label="稼働タイムラインを読み込み中です" />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default UptimeTimelineSection
