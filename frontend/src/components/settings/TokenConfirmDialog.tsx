import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface TokenConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}

function TokenConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onClose,
  onConfirm,
}: TokenConfirmDialogProps) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="confirm-dialog__backdrop" role="presentation" onClick={onClose}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--soft" onClick={onClose} disabled={loading}>
            キャンセル
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TokenConfirmDialog
