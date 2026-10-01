import { useEffect, useRef } from 'react'
import type { Pc } from '../../types/models'

interface PcShutdownDialogProps {
  pc: Pc
  disabled: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function PcShutdownDialog({ pc, disabled, onClose, onConfirm }: PcShutdownDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // 誤操作を避けるため、開いた直後はキャンセルにフォーカスする。
    cancelRef.current?.focus()
    return () => previous?.focus()
  }, [])

  return (
    <div className="confirm-dialog__backdrop" role="presentation" onClick={onClose}>
      <div className="confirm-dialog" role="dialog" aria-modal="true"
        aria-labelledby="shutdown-dialog-title" aria-describedby="shutdown-dialog-description"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          if (event.key === 'Tab') {
            // キーボード操作中のフォーカスを確認ダイアログ内に保つ。
            event.preventDefault()
            if (disabled || document.activeElement === confirmRef.current) cancelRef.current?.focus()
            else confirmRef.current?.focus()
          }
        }}
      >
        <h3 id="shutdown-dialog-title">PCをシャットダウンしますか？</h3>
        <p id="shutdown-dialog-description">
          PC「{pc.name}」（{pc.id} / {pc.ip}）をシャットダウンします。
          アプリは強制終了しません。未保存の作業などがあると停止しない場合があります。
        </p>
        {disabled ? <p className="feedback feedback--error">PCの状態が変わりました。設定とステータスを再確認してください。</p> : null}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="btn btn--soft" onClick={onClose}>キャンセル</button>
          <button ref={confirmRef} type="button" className="btn btn--danger" disabled={disabled} onClick={onConfirm}>シャットダウンする</button>
        </div>
      </div>
    </div>
  )
}
