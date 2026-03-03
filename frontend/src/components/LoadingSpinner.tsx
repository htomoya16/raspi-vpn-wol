interface LoadingSpinnerProps {
  ariaLabel?: string
  className?: string
}

function LoadingSpinner({
  ariaLabel = '読み込み中',
  className = '',
}: LoadingSpinnerProps) {
  const classes = ['loading-spinner', className].filter(Boolean).join(' ')
  return <span className={classes} role="status" aria-live="polite" aria-label={ariaLabel} />
}

export default LoadingSpinner
