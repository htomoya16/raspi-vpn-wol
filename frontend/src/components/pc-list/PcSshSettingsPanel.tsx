import { useEffect, useRef, useState, type FormEvent } from 'react'

import { formatApiError } from '../../api/http'
import {
  confirmPcHostKey, generatePcSshKey, getPcSshSettings, savePcSshSettings,
  scanPcHostKey, testPcSshConnection,
} from '../../api/ssh-settings'
import type { HostKeyCandidate, Pc, PcSshSettings } from '../../types/models'
import LoadingDots from '../LoadingDots'

interface PcSshSettingsPanelProps {
  pc: Pc
  onSettingsChanged?: () => Promise<void> | void
}

function CopyableText({ label, value }: { label: string; value: string }) {
  return <label className="pc-ssh-settings__text">{label}
    <textarea readOnly value={value} rows={value.includes('\n') ? 6 : 2} onFocus={(event) => event.currentTarget.select()} />
  </label>
}

export default function PcSshSettingsPanel({ pc, onSettingsChanged }: PcSshSettingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<PcSshSettings | null>(null)
  const [username, setUsername] = useState('')
  const [port, setPort] = useState('22')
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [candidate, setCandidate] = useState<HostKeyCandidate | null>(null)
  const [fingerprint, setFingerprint] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setBusy(true)
    setError('')
    void getPcSshSettings(pc.id).then((data) => {
      if (cancelled) return
      setSettings(data)
      setUsername(data.username)
      setPort(String(data.port))
      setEnabled(data.username ? data.enabled : true)
      setCandidate(null)
      setFingerprint('')
    }).catch((reason: unknown) => {
      if (!cancelled) setError(formatApiError(reason))
    }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [open, pc.id, pc.ip])

  const dirty = !settings || username !== settings.username || Number(port) !== settings.port || enabled !== settings.enabled
  const verified = Boolean(settings?.verified && settings.ip === pc.ip)

  async function runOperation(operation: () => Promise<PcSshSettings>, message: string): Promise<void> {
    if (inFlight.current || busy) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await operation()
      if (!mounted.current) return
      setSettings(data)
      setUsername(data.username)
      setPort(String(data.port))
      setEnabled(data.enabled)
      setCandidate(null)
      setFingerprint('')
      setNotice(message)
      // 親の一覧も更新し、接続確認後のボタン状態をすぐに反映する。
      void Promise.resolve(onSettingsChanged?.()).catch(() => undefined)
    } catch (reason) {
      if (mounted.current) {
        setError(formatApiError(reason))
        // 失敗した再テストで以前の確認結果が無効になる場合も、一覧へ反映する。
        void Promise.resolve(onSettingsChanged?.()).catch(() => undefined)
        if (settings) setSettings({ ...settings, verified: false })
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(username) || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      setError('ユーザー名とSSHポートを確認してください。')
      return
    }
    await runOperation(() => savePcSshSettings(pc.id, { username, port: Number(port), enabled }), 'SSH設定を保存しました。')
  }

  async function scanHostKey(): Promise<void> {
    if (inFlight.current || busy) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setCandidate(null)
    setFingerprint('')
    try {
      const data = await scanPcHostKey(pc.id)
      if (mounted.current) setCandidate(data)
    } catch (reason) {
      if (mounted.current) setError(formatApiError(reason))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="pc-ssh-settings">
      <button type="button" className="btn btn--soft" aria-expanded={open} disabled={busy} onClick={() => setOpen((value) => !value)}>SSH設定</button>
      {open ? <div className="pc-ssh-settings__body">
        <p>接続先: {pc.ip} ／ {verified ? '接続確認済み' : '接続テストが必要です'}</p>
        <form className="pc-edit-form" onSubmit={(event) => void saveSettings(event)}>
          <label>Windowsのローカルユーザー名
            <input value={username} disabled={busy} maxLength={64} onChange={(event) => setUsername(event.target.value)} autoComplete="off" />
          </label>
          <label>SSHポート
            <input type="number" value={port} disabled={busy} min={1} max={65535} onChange={(event) => setPort(event.target.value)} />
          </label>
          <label className="pc-ssh-settings__checkbox"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />接続テスト成功後にシャットダウンを有効にする</label>
          <button type="submit" className="btn btn--primary" disabled={busy || !dirty}>SSH設定を保存</button>
        </form>
        <p>設定を保存して鍵を作成します。再度作成しても同じ鍵を使います。</p>
        <button type="button" className="btn btn--soft" disabled={busy || dirty || !settings?.username} onClick={() => void runOperation(() => generatePcSshKey(pc.id), '公開鍵を用意しました。Windows側で登録してください。')}>鍵を作成・表示</button>
        {settings?.public_key ? <>
          <CopyableText label="公開鍵" value={settings.public_key} />
          <p>WindowsでOpenSSHサーバーを有効にし、上で指定したユーザーのPowerShellで登録コマンドを実行してください。</p>
          {settings.setup_script ? <CopyableText label="Windowsで実行する公開鍵登録コマンド" value={settings.setup_script} /> : null}
          <p>続いてPC側のPowerShellで以下を実行し、表示されたSHA256の指紋を確認します。</p>
          <CopyableText label="PC側のホスト鍵を確認するコマンド" value={settings.fingerprint_command} />
          {settings.host_fingerprint ? <p className="pc-ssh-settings__fingerprint">登録済みの指紋: {settings.host_fingerprint}</p> : null}
          <button type="button" className="btn btn--soft" disabled={busy || dirty} onClick={() => void scanHostKey()}>PCのホスト鍵を取得</button>
          {candidate ? <div>
            <p className="pc-ssh-settings__fingerprint">取得した指紋: {candidate.fingerprint}</p>
            <label className="pc-ssh-settings__text">PC側で確認したSHA256の指紋
              <input value={fingerprint} disabled={busy || dirty} onChange={(event) => setFingerprint(event.target.value)} placeholder="SHA256:…" autoComplete="off" />
            </label>
            <button type="button" className="btn btn--primary" disabled={busy || dirty || fingerprint.trim() !== candidate.fingerprint} onClick={() => void runOperation(() => confirmPcHostKey(pc.id, candidate, fingerprint), '指紋が一致するホスト鍵を登録しました。')}>指紋を照合して登録</button>
          </div> : null}
          <button type="button" className="btn btn--primary" disabled={busy || dirty || !settings.host_fingerprint} onClick={() => void runOperation(() => testPcSshConnection(pc.id), 'SSH接続テストに成功しました。停止命令は送っていません。')}>接続テスト</button>
        </> : null}
        {busy ? <LoadingDots label="SSH設定を処理中" /> : null}
        {error ? <p role="alert" className="feedback feedback--error">{error}</p> : null}
        {notice ? <p role="status" className="feedback feedback--notice">{notice}</p> : null}
      </div> : null}
    </section>
  )
}
