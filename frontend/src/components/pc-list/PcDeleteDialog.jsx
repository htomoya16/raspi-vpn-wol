function PcDeleteDialog({
  pendingDelete,
  confirmLoading,
  onCloseDeleteDialog,
  onConfirmDelete,
}) {
  if (!pendingDelete) {
    return null
  }

  return (
    <div className="confirm-dialog__backdrop" role="presentation" onClick={onCloseDeleteDialog}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="delete-dialog-title">PCを削除しますか？</h3>
        <p id="delete-dialog-description">
          PC「{pendingDelete.name}」（{pendingDelete.id}）を削除します。この操作は取り消せません。
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--soft" onClick={onCloseDeleteDialog} disabled={confirmLoading}>
            キャンセル
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirmDelete} disabled={confirmLoading}>
            {confirmLoading ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PcDeleteDialog
