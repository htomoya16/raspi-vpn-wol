interface LoadingDotsProps {
  label: string
  className?: string
}

function LoadingDots({ label, className = '' }: LoadingDotsProps) {
  const classes = ['loading-ellipsis', className].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      <span>{label}</span>
      <span className="loading-ellipsis__trail" aria-hidden="true">
        <span className="loading-ellipsis__dot">・</span>
        <span className="loading-ellipsis__dot">・</span>
        <span className="loading-ellipsis__dot">・</span>
      </span>
    </span>
  )
}

export default LoadingDots
