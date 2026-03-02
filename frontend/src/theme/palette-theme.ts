import { applyThemeVars, type ThemeVarMap } from './apply-theme-vars'
import { mixHex, toRgba } from './color-utils'
import type { EffectiveAppearanceMode, ThemeOption } from './types'

export function applyPaletteTheme(root: HTMLElement, appearanceMode: EffectiveAppearanceMode, selectedTheme: ThemeOption): void {
  const darkBase = mixHex('#050d1d', selectedTheme.primaryStrong, 0.25)
  const darkSoft = mixHex('#0b1b37', selectedTheme.primary, 0.3)
  const darkCard = mixHex('#0b1a34', selectedTheme.primaryStrong, 0.24)
  const darkLine = mixHex('#27456f', selectedTheme.primary, 0.35)
  const darkSurfaceStrong = mixHex('#08172f', selectedTheme.primaryStrong, 0.22)
  const darkSurfaceMuted = mixHex('#0d1e38', selectedTheme.primaryStrong, 0.24)
  const darkSurfaceAlt = mixHex('#143563', selectedTheme.primary, 0.18)
  const darkSurfaceHover = mixHex('#255793', selectedTheme.primary, 0.22)
  const darkTableHead = mixHex('#0f2a4b', selectedTheme.primaryStrong, 0.24)
  const darkGroupJob = mixHex('#16365f', selectedTheme.primary, 0.24)
  const darkGroupNormal = mixHex('#2a284f', selectedTheme.primaryStrong, 0.18)
  const darkGroupHover = mixHex('#214a7a', selectedTheme.primary, 0.24)
  const darkTimelineColumn = mixHex('#09162a', selectedTheme.primaryStrong, 0.2)
  const darkTimelineEvent = mixHex('#3b82f6', selectedTheme.primary, 0.75)
  const darkNoticeBg = mixHex('#112845', selectedTheme.primaryStrong, 0.34)
  const darkNoticeText = mixHex('#b7d5ff', selectedTheme.accent, 0.18)
  const darkErrorBg = mixHex('#3a1822', selectedTheme.primaryStrong, 0.2)
  const darkErrorText = mixHex('#ffc3cf', selectedTheme.accent, 0.08)
  const darkDangerBg = mixHex('#6a2236', selectedTheme.primaryStrong, 0.16)
  const darkDangerBorder = mixHex('#8a3350', selectedTheme.primaryStrong, 0.1)
  const darkDangerText = mixHex('#ffd7de', selectedTheme.accent, 0.06)

  const lightBase = mixHex('#f4f8ff', selectedTheme.primary, 0.08)
  const lightSoft = mixHex('#e7efff', selectedTheme.accent, 0.12)
  const lightCard = mixHex('#ffffff', selectedTheme.primary, 0.04)
  const lightLine = mixHex('#bfd0ea', selectedTheme.primary, 0.36)
  const lightSurfaceStrong = mixHex('#ffffff', selectedTheme.primary, 0.08)
  const lightSurfaceMuted = mixHex('#edf3ff', selectedTheme.primary, 0.12)
  const lightSurfaceAlt = mixHex('#d7e6ff', selectedTheme.primary, 0.25)
  const lightSurfaceHover = mixHex('#c9ddff', selectedTheme.primary, 0.3)
  const lightTableHead = mixHex('#e8f1ff', selectedTheme.primary, 0.2)
  const lightGroupJob = mixHex('#dcecff', selectedTheme.primary, 0.28)
  const lightGroupNormal = mixHex('#e7e8ff', selectedTheme.primaryStrong, 0.15)
  const lightGroupHover = mixHex('#cfe2ff', selectedTheme.primary, 0.32)
  const lightTimelineColumn = mixHex('#f5f9ff', selectedTheme.primary, 0.1)
  const lightTimelineEvent = mixHex('#3e78d5', selectedTheme.primary, 0.7)
  const lightNoticeBg = mixHex('#e6f0ff', selectedTheme.primary, 0.18)
  const lightNoticeText = mixHex('#2d4f80', selectedTheme.primaryStrong, 0.22)
  const lightErrorBg = mixHex('#ffe7ed', selectedTheme.primaryStrong, 0.1)
  const lightErrorText = mixHex('#943651', selectedTheme.primaryStrong, 0.2)
  const lightDangerBg = mixHex('#ffe7ed', selectedTheme.primaryStrong, 0.12)
  const lightDangerBorder = mixHex('#d88ba2', selectedTheme.primaryStrong, 0.18)
  const lightDangerText = mixHex('#8f2f4a', selectedTheme.primaryStrong, 0.24)
  const focusRing = mixHex('#5b9bff', selectedTheme.accent, 0.58)

  const sharedVars: ThemeVarMap = {
    '--primary': selectedTheme.primary,
    '--primary-strong': selectedTheme.primaryStrong,
    '--accent': selectedTheme.accent,
    '--btn-primary-end': selectedTheme.primaryStrong,
    '--btn-primary-shadow': toRgba(selectedTheme.primary, 0.42),
    '--floating-switch-shadow': `0 14px 32px ${toRgba(selectedTheme.primaryStrong, 0.42)}`,
    '--floating-switch-shadow-hover': `0 18px 36px ${toRgba(selectedTheme.primaryStrong, 0.5)}`,
    '--btn-primary-text': '#ffffff',
    '--focus-ring': focusRing,
    '--focus-ring-shadow': toRgba(focusRing, 0.32),
    '--bg-glow-primary': toRgba(selectedTheme.primary, 0.28),
    '--bg-glow-primary-soft': toRgba(selectedTheme.primary, 0.11),
    '--bg-glow-accent': toRgba(selectedTheme.accent, 0.24),
    '--bg-glow-accent-soft': toRgba(selectedTheme.accent, 0.09),
  }

  if (appearanceMode === 'dark') {
    const darkVars: ThemeVarMap = {
      '--hero-eyebrow-color': mixHex('#d6e8ff', selectedTheme.accent, 0.18),
      '--bg-base': darkBase,
      '--bg-soft': darkSoft,
      '--bg-card': toRgba(darkCard, 0.82),
      '--line': darkLine,
      '--text-main': mixHex('#e9f0ff', selectedTheme.accent, 0.06),
      '--text-sub': mixHex('#9fb2d9', selectedTheme.accent, 0.16),
      '--surface-elevated': toRgba(darkSoft, 0.72),
      '--surface-elevated-soft': toRgba(darkSoft, 0.48),
      '--surface-strong': toRgba(darkSurfaceStrong, 0.86),
      '--surface-muted': toRgba(darkSurfaceMuted, 0.82),
      '--surface-alt': toRgba(darkSurfaceAlt, 0.42),
      '--surface-hover': toRgba(darkSurfaceHover, 0.34),
      '--surface-overlay': toRgba(darkSurfaceStrong, 0.58),
      '--overlay-backdrop': 'rgba(2, 9, 23, 0.72)',
      '--btn-soft-bg': toRgba(darkSurfaceAlt, 0.5),
      '--btn-soft-text': mixHex('#d6e5ff', selectedTheme.accent, 0.28),
      '--btn-soft-border': toRgba(mixHex(darkLine, selectedTheme.accent, 0.18), 0.76),
      '--btn-soft-hover-bg': toRgba(darkSurfaceAlt, 0.58),
      '--btn-danger-bg': darkDangerBg,
      '--btn-danger-border': darkDangerBorder,
      '--btn-danger-text': darkDangerText,
      '--badge-device-bg': toRgba(mixHex('#4c9dff', selectedTheme.primary, 0.32), 0.22),
      '--badge-device-text': mixHex('#e9f0ff', selectedTheme.accent, 0.08),
      '--badge-device-border': toRgba(mixHex('#68adff', selectedTheme.accent, 0.24), 0.72),
      '--loading-spinner-track': toRgba(mixHex('#a3bef0', selectedTheme.accent, 0.18), 0.35),
      '--feedback-success-bg': toRgba(mixHex('#38a46e', selectedTheme.accent, 0.16), 0.22),
      '--feedback-success-text': mixHex('#d9f8e8', selectedTheme.accent, 0.08),
      '--feedback-success-border': toRgba(mixHex('#38a46e', selectedTheme.primary, 0.18), 0.36),
      '--panel-border': toRgba(darkLine, 0.34),
      '--panel-shadow': '0 20px 45px rgba(2, 8, 24, 0.45)',
      '--overlay-panel-shadow': toRgba(mixHex('#020818', selectedTheme.primaryStrong, 0.56), 0.55),
      '--modal-bg': toRgba(mixHex(darkSurfaceStrong, darkBase, 0.28), 0.94),
      '--modal-border': toRgba(mixHex(darkLine, selectedTheme.primary, 0.24), 0.82),
      '--modal-text-sub': mixHex('#b7caec', selectedTheme.accent, 0.22),
      '--theme-swatch-border': toRgba(mixHex('#dceaff', selectedTheme.accent, 0.12), 0.35),
      '--notice-bg': darkNoticeBg,
      '--notice-text': darkNoticeText,
      '--error-bg': darkErrorBg,
      '--error-text': darkErrorText,
      '--table-head-bg': toRgba(darkTableHead, 0.96),
      '--group-sticky-bg': toRgba(darkTableHead, 0.95),
      '--group-job-bg': toRgba(darkGroupJob, 0.96),
      '--group-normal-bg': toRgba(darkGroupNormal, 0.96),
      '--group-hover-bg': toRgba(darkGroupHover, 0.96),
      '--state-ok-bg': 'rgba(16, 80, 56, 0.78)',
      '--state-ok-text': '#9ef5ca',
      '--state-ng-bg': 'rgba(88, 32, 32, 0.78)',
      '--state-ng-text': '#ffc1b2',
      '--state-unknown-bg': 'rgba(56, 70, 95, 0.78)',
      '--state-unknown-text': '#c3d1f2',
      '--state-running-bg': 'rgba(103, 74, 18, 0.78)',
      '--state-running-text': '#ffe08f',
      '--state-unreachable-bg': 'rgba(92, 38, 55, 0.78)',
      '--state-unreachable-text': '#ffc0d4',
      '--state-total-bg': 'rgba(36, 62, 101, 0.78)',
      '--state-total-text': '#d1e3ff',
      '--chart-axis-line': toRgba(mixHex('#4f72aa', selectedTheme.primary, 0.2), 0.45),
      '--chart-axis-text': mixHex('#8fa6cf', selectedTheme.accent, 0.2),
      '--chart-grid-line': toRgba(mixHex('#7e9fd3', selectedTheme.primary, 0.2), 0.2),
      '--chart-plot-bg': toRgba(darkSurfaceStrong, 0.76),
      '--chart-avg-line': 'rgba(72, 197, 133, 0.9)',
      '--chart-avg-bg': toRgba(darkSurfaceMuted, 0.92),
      '--chart-avg-border': 'rgba(72, 197, 133, 0.5)',
      '--chart-avg-text': '#82e2b2',
      '--chart-bar-bg': mixHex('#4f93ff', selectedTheme.primary, 0.6),
      '--chart-bar-shadow': toRgba(mixHex('#2563eb', selectedTheme.primaryStrong, 0.5), 0.32),
      '--timeline-axis-line': toRgba(mixHex('#4f72aa', selectedTheme.primary, 0.2), 0.35),
      '--timeline-axis-text': mixHex('#8fa6cf', selectedTheme.accent, 0.2),
      '--timeline-axis-hourly': mixHex('#9bb3dd', selectedTheme.accent, 0.22),
      '--timeline-day-border': toRgba(mixHex('#5575ab', selectedTheme.primary, 0.2), 0.4),
      '--timeline-day-title': '#d8e5ff',
      '--timeline-day-date': mixHex('#9ad5ff', selectedTheme.accent, 0.3),
      '--timeline-column-bg': toRgba(darkTimelineColumn, 0.88),
      '--timeline-hour-line': toRgba(mixHex('#4f72aa', selectedTheme.primary, 0.2), 0.32),
      '--timeline-event-bg': darkTimelineEvent,
      '--timeline-event-text': '#f5f9ff',
      '--timeline-event-shadow': toRgba(mixHex('#0f2a56', selectedTheme.primaryStrong, 0.5), 0.42),
      '--mobile-nav-bg-start': toRgba(darkBase, 0.86),
      '--mobile-nav-bg-end': toRgba(darkSoft, 0.72),
      '--mobile-nav-border': toRgba(darkLine, 0.34),
      '--mobile-nav-text': mixHex('#b5c8eb', selectedTheme.accent, 0.24),
      '--mobile-nav-text-active': mixHex('#ffffff', selectedTheme.accent, 0.08),
      '--mobile-nav-icon-filter': 'brightness(0) saturate(100%) invert(74%) sepia(20%) saturate(376%) hue-rotate(185deg) brightness(94%) contrast(92%)',
      '--mobile-nav-icon-active-filter': 'brightness(0) saturate(100%) invert(100%)',
      '--header-settings-icon-filter': 'brightness(0) saturate(100%) invert(100%)',
      '--floating-switch-icon-filter': 'brightness(0) saturate(100%) invert(100%)',
      '--mobile-register-bg-start': toRgba(darkSurfaceMuted, 0.9),
      '--mobile-register-bg-end': toRgba(darkSurfaceStrong, 0.84),
      '--mobile-register-border': toRgba(darkLine, 0.52),
      '--mobile-register-active-start': selectedTheme.primary,
      '--mobile-register-active-end': mixHex(selectedTheme.accent, selectedTheme.primaryStrong, 0.6),
      '--mobile-register-active-shadow': toRgba(selectedTheme.primary, 0.32),
      '--scrollbar-track': toRgba(darkSurfaceMuted, 0.56),
      '--scrollbar-thumb': toRgba(mixHex('#7faef8', selectedTheme.primary, 0.45), 0.84),
      '--scrollbar-thumb-hover': toRgba(mixHex('#9ec3ff', selectedTheme.accent, 0.32), 0.94),
    }

    applyThemeVars(root, { ...sharedVars, ...darkVars })
    return
  }

  const lightVars: ThemeVarMap = {
    '--bg-base': lightBase,
    '--hero-eyebrow-color': mixHex('#2f4f80', selectedTheme.primaryStrong, 0.32),
    '--bg-soft': lightSoft,
    '--bg-card': toRgba(lightCard, 0.88),
    '--line': lightLine,
    '--text-main': mixHex('#1a2f55', selectedTheme.primaryStrong, 0.12),
    '--text-sub': mixHex('#4f6691', selectedTheme.primaryStrong, 0.2),
    '--surface-elevated': toRgba(lightSoft, 0.68),
    '--surface-elevated-soft': toRgba(lightSoft, 0.42),
    '--surface-strong': toRgba(lightSurfaceStrong, 0.95),
    '--surface-muted': toRgba(lightSurfaceMuted, 0.96),
    '--surface-alt': toRgba(lightSurfaceAlt, 0.45),
    '--surface-hover': toRgba(lightSurfaceHover, 0.52),
    '--surface-overlay': toRgba(lightSurfaceMuted, 0.64),
    '--overlay-backdrop': 'rgba(15, 36, 69, 0.42)',
    '--btn-soft-bg': toRgba(lightSurfaceAlt, 0.66),
    '--btn-soft-text': mixHex('#274471', selectedTheme.primaryStrong, 0.32),
    '--btn-soft-border': toRgba(mixHex(lightLine, selectedTheme.primaryStrong, 0.2), 0.84),
    '--btn-soft-hover-bg': toRgba(lightSurfaceAlt, 0.7),
    '--btn-danger-bg': lightDangerBg,
    '--btn-danger-border': lightDangerBorder,
    '--btn-danger-text': lightDangerText,
    '--badge-device-bg': toRgba(mixHex('#4c9dff', selectedTheme.primary, 0.3), 0.16),
    '--badge-device-text': mixHex('#1f3d6a', selectedTheme.primaryStrong, 0.24),
    '--badge-device-border': toRgba(mixHex('#68adff', selectedTheme.primary, 0.3), 0.56),
    '--loading-spinner-track': toRgba(mixHex('#8ca9d8', selectedTheme.primary, 0.24), 0.32),
    '--feedback-success-bg': toRgba(mixHex('#208856', selectedTheme.primary, 0.24), 0.18),
    '--feedback-success-text': mixHex('#1c8152', selectedTheme.primaryStrong, 0.16),
    '--feedback-success-border': toRgba(mixHex('#208856', selectedTheme.primaryStrong, 0.22), 0.34),
    '--panel-border': toRgba(lightLine, 0.85),
    '--panel-shadow': '0 14px 28px rgba(30, 62, 109, 0.12)',
    '--overlay-panel-shadow': toRgba(mixHex('#2f568f', selectedTheme.primaryStrong, 0.36), 0.2),
    '--modal-bg': toRgba(lightSurfaceStrong, 0.98),
    '--modal-border': toRgba(mixHex(lightLine, selectedTheme.primary, 0.24), 0.86),
    '--modal-text-sub': mixHex('#5f78a8', selectedTheme.primaryStrong, 0.28),
    '--theme-swatch-border': toRgba(mixHex('#8bb2e5', selectedTheme.primary, 0.24), 0.42),
    '--notice-bg': lightNoticeBg,
    '--notice-text': lightNoticeText,
    '--error-bg': lightErrorBg,
    '--error-text': lightErrorText,
    '--table-head-bg': toRgba(lightTableHead, 0.98),
    '--group-sticky-bg': toRgba(lightTableHead, 0.98),
    '--group-job-bg': toRgba(lightGroupJob, 0.98),
    '--group-normal-bg': toRgba(lightGroupNormal, 0.98),
    '--group-hover-bg': toRgba(lightGroupHover, 0.98),
    '--state-ok-bg': 'rgba(32, 136, 86, 0.2)',
    '--state-ok-text': '#1c8152',
    '--state-ng-bg': 'rgba(191, 71, 71, 0.18)',
    '--state-ng-text': '#aa3737',
    '--state-unknown-bg': 'rgba(92, 111, 150, 0.2)',
    '--state-unknown-text': '#44608f',
    '--state-running-bg': 'rgba(176, 133, 39, 0.2)',
    '--state-running-text': '#8b6708',
    '--state-unreachable-bg': 'rgba(155, 73, 101, 0.18)',
    '--state-unreachable-text': '#8f3556',
    '--state-total-bg': 'rgba(102, 132, 183, 0.2)',
    '--state-total-text': '#426394',
    '--chart-axis-line': toRgba(mixHex('#95b2de', selectedTheme.primary, 0.3), 0.62),
    '--chart-axis-text': mixHex('#5f78a8', selectedTheme.primaryStrong, 0.22),
    '--chart-grid-line': toRgba(mixHex('#a8c0e5', selectedTheme.primary, 0.25), 0.36),
    '--chart-plot-bg': toRgba(lightSurfaceStrong, 0.92),
    '--chart-avg-line': 'rgba(39, 153, 99, 0.82)',
    '--chart-avg-bg': toRgba(lightSurfaceMuted, 0.96),
    '--chart-avg-border': 'rgba(39, 153, 99, 0.4)',
    '--chart-avg-text': '#1f8a5b',
    '--chart-bar-bg': mixHex('#3f82e8', selectedTheme.primary, 0.75),
    '--chart-bar-shadow': toRgba(mixHex('#2f65b8', selectedTheme.primaryStrong, 0.38), 0.28),
    '--timeline-axis-line': toRgba(mixHex('#95b2de', selectedTheme.primary, 0.3), 0.56),
    '--timeline-axis-text': mixHex('#5f78a8', selectedTheme.primaryStrong, 0.22),
    '--timeline-axis-hourly': mixHex('#5f78a8', selectedTheme.primaryStrong, 0.18),
    '--timeline-day-border': toRgba(mixHex('#95b2de', selectedTheme.primary, 0.3), 0.62),
    '--timeline-day-title': '#2a4573',
    '--timeline-day-date': mixHex('#3d679f', selectedTheme.primary, 0.32),
    '--timeline-column-bg': toRgba(lightTimelineColumn, 0.95),
    '--timeline-hour-line': toRgba(mixHex('#95b2de', selectedTheme.primary, 0.3), 0.42),
    '--timeline-event-bg': lightTimelineEvent,
    '--timeline-event-text': '#f5f9ff',
    '--timeline-event-shadow': toRgba(mixHex('#2a5799', selectedTheme.primaryStrong, 0.3), 0.28),
    '--mobile-nav-bg-start': toRgba(lightBase, 0.9),
    '--mobile-nav-bg-end': toRgba(lightSoft, 0.72),
    '--mobile-nav-border': toRgba(lightLine, 0.52),
    '--mobile-nav-text': mixHex('#4f6691', selectedTheme.primaryStrong, 0.2),
    '--mobile-nav-text-active': mixHex('#1a2f55', selectedTheme.primaryStrong, 0.18),
    '--mobile-nav-icon-filter': 'brightness(0) saturate(100%) invert(31%) sepia(18%) saturate(780%) hue-rotate(182deg) brightness(93%) contrast(88%)',
    '--mobile-nav-icon-active-filter': 'brightness(0) saturate(100%) invert(19%) sepia(27%) saturate(909%) hue-rotate(183deg) brightness(92%) contrast(90%)',
    '--header-settings-icon-filter': 'brightness(0) saturate(100%) invert(19%) sepia(27%) saturate(909%) hue-rotate(183deg) brightness(92%) contrast(90%)',
    '--floating-switch-icon-filter': 'brightness(0) saturate(100%) invert(12%) sepia(27%) saturate(603%) hue-rotate(183deg) brightness(92%) contrast(88%)',
    '--mobile-register-bg-start': toRgba(lightSurfaceStrong, 0.94),
    '--mobile-register-bg-end': toRgba(lightSurfaceMuted, 0.8),
    '--mobile-register-border': toRgba(lightLine, 0.72),
    '--mobile-register-active-start': mixHex(selectedTheme.primary, '#4d8fff', 0.25),
    '--mobile-register-active-end': mixHex(selectedTheme.primaryStrong, selectedTheme.accent, 0.2),
    '--mobile-register-active-shadow': toRgba(selectedTheme.primary, 0.26),
    '--scrollbar-track': toRgba(lightSurfaceMuted, 0.94),
    '--scrollbar-thumb': toRgba(mixHex('#7b9fd4', selectedTheme.primary, 0.32), 0.8),
    '--scrollbar-thumb-hover': toRgba(mixHex('#5d86c2', selectedTheme.primaryStrong, 0.24), 0.9),
  }

  applyThemeVars(root, { ...sharedVars, ...lightVars })
}
