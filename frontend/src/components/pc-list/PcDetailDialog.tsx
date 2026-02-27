import type { FormEvent } from 'react'

import type { Pc } from '../../types/models'
import { formatLocalDateTime } from '../../utils/datetime'
import LoadingDots from '../LoadingDots'
import type { PcEditFormState } from './constants'

interface PcDetailDialogProps {
  selectedPc: Pc
  isEditing: boolean
  editForm: PcEditFormState
  editError: string
  editLoading: boolean
  deleteBusy: boolean
  rowError?: string
  statusLabel: string
  onClose: () => void
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onStartEdit: () => void
  onCancelEdit: () => void
  onOpenDeleteDialog: (pcId: string, pcName: string) => void
  onUpdateEditField: (key: keyof PcEditFormState, value: string) => void
}

function PcDetailDialog({
  selectedPc,
  isEditing,
  editForm,
  editError,
  editLoading,
  deleteBusy,
  rowError,
  statusLabel,
  onClose,
  onSubmitEdit,
  onStartEdit,
  onCancelEdit,
  onOpenDeleteDialog,
  onUpdateEditField,
}: PcDetailDialogProps) {
  return (
    <div className="pc-detail-dialog__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pc-detail pc-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pc-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pc-detail__header">
          <div>
            <h3 id="pc-detail-title">{selectedPc.name}</h3>
            <p>{selectedPc.id}</p>
          </div>
          <div className="pc-detail__header-side">
            <span className={`status-badge status-badge--${selectedPc.status}`}>{statusLabel}</span>
            <button type="button" className="btn btn--soft" onClick={onClose} disabled={editLoading}>
              閉じる
            </button>
          </div>
        </div>

        {isEditing ? (
          <form className="pc-edit-form" onSubmit={onSubmitEdit} noValidate>
            <label>
              表示名
              <input
                type="text"
                value={editForm.name}
                onChange={(event) => onUpdateEditField('name', event.target.value)}
                required
              />
            </label>

            <label>
              MACアドレス
              <input
                type="text"
                value={editForm.mac}
                onChange={(event) => onUpdateEditField('mac', event.target.value)}
                required
              />
            </label>

            <label>
              IPアドレス（任意）
              <input
                type="text"
                value={editForm.ip}
                onChange={(event) => onUpdateEditField('ip', event.target.value)}
              />
            </label>

            <label>
              タグ（カンマ区切り・任意）
              <input
                type="text"
                value={editForm.tags}
                onChange={(event) => onUpdateEditField('tags', event.target.value)}
              />
            </label>

            <label>
              メモ（任意）
              <textarea
                rows={3}
                value={editForm.note}
                onChange={(event) => onUpdateEditField('note', event.target.value)}
              />
            </label>

            {editError ? <p className="feedback feedback--error">{editError}</p> : null}

            <div className="pc-detail__actions">
              <button type="submit" className="btn btn--primary" disabled={editLoading}>
                {editLoading ? <LoadingDots label="保存中" /> : '保存'}
              </button>
              <button type="button" className="btn btn--soft" onClick={onCancelEdit} disabled={editLoading}>
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="pc-detail__grid">
              <div className="pc-detail__item">
                <dt>MAC</dt>
                <dd className="pc-row__cell pc-row__cell--mono">{selectedPc.mac}</dd>
              </div>
              <div className="pc-detail__item">
                <dt>IP</dt>
                <dd className="pc-row__cell">{selectedPc.ip || '未設定'}</dd>
              </div>
              <div className="pc-detail__item">
                <dt>最終確認</dt>
                <dd className="pc-row__cell">
                  {formatLocalDateTime(selectedPc.last_seen_at, { fallback: '未記録' })}
                </dd>
              </div>
              <div className="pc-detail__item">
                <dt>タグ</dt>
                <dd className="pc-row__cell">
                  {(selectedPc.tags || []).length > 0 ? selectedPc.tags.join(', ') : '未設定'}
                </dd>
              </div>
              <div className="pc-detail__item">
                <dt>メモ</dt>
                <dd className="pc-row__cell">{selectedPc.note || '未設定'}</dd>
              </div>
            </dl>

            <div className="pc-detail__actions">
              <button type="button" className="btn btn--soft" onClick={onStartEdit}>
                編集
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onOpenDeleteDialog(selectedPc.id, selectedPc.name)}
                disabled={deleteBusy}
              >
                {deleteBusy ? <LoadingDots label="削除中" /> : '削除'}
              </button>
            </div>
          </>
        )}

        {rowError ? <p className="feedback feedback--error">{rowError}</p> : null}
      </section>
    </div>
  )
}

export default PcDetailDialog
