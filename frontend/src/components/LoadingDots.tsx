interface LoadingDotsProps {
  label?: string
  ariaLabel?: string
  className?: string
}

function LoadingDots({ label, ariaLabel, className = '' }: LoadingDotsProps) {
  const classes = ['loading-ellipsis', className].filter(Boolean).join(' ')
  const accessibleLabel = ariaLabel || label || '読み込み中'

  return (
    <span className={classes} role="status" aria-live="polite" aria-label={accessibleLabel}>
      {label ? <span>{label}</span> : null}
      <span className="loading-ellipsis__trail" aria-hidden="true">
        <span className="loading-ellipsis__dot">・</span>
        <span className="loading-ellipsis__dot">・</span>
        <span className="loading-ellipsis__dot">・</span>
      </span>
    </span>
  )
}

export default LoadingDots
