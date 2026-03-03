import { createPortal } from 'react-dom'

import type { ApiToken } from '../../types/models'

interface TokenDeleteDialogProps {
  target: ApiToken | null
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}

function TokenDeleteDialog({ target, deleting, onClose, onConfirm }: TokenDeleteDialogProps) {
  if (target == null || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="confirm-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-delete-dialog-title"
        aria-describedby="token-delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="token-delete-dialog-title">トークンを削除しますか？</h3>
        <p id="token-delete-dialog-description">
          <strong>{target.name}</strong>（{target.token_prefix}）を削除します。この操作は取り消せません。
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--soft" onClick={onClose} disabled={deleting}>
            キャンセル
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TokenDeleteDialog
