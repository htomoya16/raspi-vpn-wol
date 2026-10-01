import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as sshApi from '../../api/ssh-settings'
import { createPcFactory } from '../../test/factories'
import type { PcSshSettings } from '../../types/models'
import PcSshSettingsPanel from './PcSshSettingsPanel'

vi.mock('../../api/ssh-settings', () => ({
  getPcSshSettings: vi.fn(), savePcSshSettings: vi.fn(), generatePcSshKey: vi.fn(),
  scanPcHostKey: vi.fn(), confirmPcHostKey: vi.fn(), testPcSshConnection: vi.fn(),
}))

const emptySettings: PcSshSettings = {
  pc_id: 'pc-1', ip: '192.168.10.10', username: '', port: 22, enabled: false,
  public_key: null, host_fingerprint: null, verified: false, verified_at: null,
  setup_script: null, fingerprint_command: 'ssh-keygen.exe -lf host-key.pub',
}
const savedSettings = { ...emptySettings, username: 'wol-user', enabled: true }
const keySettings = { ...savedSettings, public_key: 'ssh-ed25519 public-key', setup_script: 'Register-PublicKey' }
const confirmedSettings = { ...keySettings, host_fingerprint: 'SHA256:confirmed' }

beforeEach(() => { vi.resetAllMocks() })

describe('PC SSH setup', () => {
  it('guides setup through key registration and fingerprint confirmation before connection verification', async () => {
    const user = userEvent.setup()
    const onSettingsChanged = vi.fn()
    vi.mocked(sshApi.getPcSshSettings).mockResolvedValue(emptySettings)
    vi.mocked(sshApi.savePcSshSettings).mockResolvedValue(savedSettings)
    vi.mocked(sshApi.generatePcSshKey).mockResolvedValue(keySettings)
    const candidate = { host_key: 'ssh-ed25519 host-key', fingerprint: 'SHA256:confirmed', ip: emptySettings.ip, revision: 1 }
    vi.mocked(sshApi.scanPcHostKey).mockResolvedValue(candidate)
    vi.mocked(sshApi.confirmPcHostKey).mockResolvedValue(confirmedSettings)
    vi.mocked(sshApi.testPcSshConnection).mockResolvedValue({ ...confirmedSettings, verified: true, verified_at: '2026-10-01T00:00:00Z' })
    render(<PcSshSettingsPanel pc={createPcFactory()} onSettingsChanged={onSettingsChanged} />)
    expect(sshApi.getPcSshSettings).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'SSH設定' }))
    const username = await screen.findByLabelText('Windowsのローカルユーザー名')
    await waitFor(() => expect(username).toBeEnabled())
    await user.type(username, 'wol-user')
    await user.click(screen.getByRole('button', { name: 'SSH設定を保存' }))
    expect(sshApi.savePcSshSettings).toHaveBeenCalledWith('pc-1', { username: 'wol-user', port: 22, enabled: true })
    await user.click(screen.getByRole('button', { name: '鍵を作成・表示' }))
    expect(await screen.findByLabelText('公開鍵')).toHaveValue(keySettings.public_key)
    expect(screen.getByLabelText('Windowsで実行する公開鍵登録コマンド')).toHaveValue('Register-PublicKey')
    expect(screen.getByRole('button', { name: '接続テスト' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'PCのホスト鍵を取得' }))
    const fingerprint = await screen.findByLabelText('PC側で確認したSHA256の指紋')
    const confirm = screen.getByRole('button', { name: '指紋を照合して登録' })
    await user.type(fingerprint, 'SHA256:wrong')
    expect(confirm).toBeDisabled()
    await user.clear(fingerprint)
    await user.type(fingerprint, candidate.fingerprint)
    await user.click(confirm)
    expect(sshApi.confirmPcHostKey).toHaveBeenCalledWith('pc-1', candidate, candidate.fingerprint)
    await user.click(screen.getByRole('button', { name: '接続テスト' }))
    expect(await screen.findByText(/接続先:.*接続確認済み/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('停止命令は送っていません')
    expect(sshApi.testPcSshConnection).toHaveBeenCalledExactlyOnceWith('pc-1')
    expect(onSettingsChanged).toHaveBeenCalledTimes(4)
  })

  it('refreshes the PC state and removes verification after a failed retest', async () => {
    const user = userEvent.setup()
    const onSettingsChanged = vi.fn()
    vi.mocked(sshApi.getPcSshSettings).mockResolvedValue({ ...confirmedSettings, verified: true })
    vi.mocked(sshApi.testPcSshConnection).mockRejectedValue(new Error('SSH接続に失敗しました'))
    render(<PcSshSettingsPanel pc={createPcFactory()} onSettingsChanged={onSettingsChanged} />)
    await user.click(screen.getByRole('button', { name: 'SSH設定' }))
    await screen.findByText(/接続先:.*接続確認済み/)
    await user.click(screen.getByRole('button', { name: '接続テスト' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('SSH接続に失敗しました')
    expect(screen.getByText(/接続先:.*接続テストが必要です/)).toBeInTheDocument()
    expect(onSettingsChanged).toHaveBeenCalledOnce()
  })
})
