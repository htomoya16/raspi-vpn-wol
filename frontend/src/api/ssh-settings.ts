import { request } from './http'
import { invalidatePcsAndUptimeCache } from './pcs'
import { invalidateLogsCache } from './logs'
import type { HostKeyCandidate, PcSshSettings, PcSshSettingsPayload } from '../types/models'

function settingsPath(pcId: string): string {
  return `/api/pcs/${encodeURIComponent(pcId)}/ssh`
}

async function mutateSettings(pcId: string, suffix: string, method: string, payload?: unknown): Promise<PcSshSettings> {
  try {
    return await request<PcSshSettings>(`${settingsPath(pcId)}${suffix}`, {
      method,
      ...(payload === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    })
  } finally {
    // 接続テスト失敗時も、解除された確認状態と操作ログを取り直す。
    invalidatePcsAndUptimeCache(pcId)
    invalidateLogsCache()
  }
}

export function getPcSshSettings(pcId: string): Promise<PcSshSettings> {
  return request<PcSshSettings>(settingsPath(pcId))
}

export function savePcSshSettings(pcId: string, payload: PcSshSettingsPayload): Promise<PcSshSettings> {
  return mutateSettings(pcId, '', 'PUT', payload)
}

export function generatePcSshKey(pcId: string): Promise<PcSshSettings> {
  return mutateSettings(pcId, '/key', 'POST')
}

export function scanPcHostKey(pcId: string): Promise<HostKeyCandidate> {
  return request<HostKeyCandidate>(`${settingsPath(pcId)}/host-key/scan`, { method: 'POST' })
}

export function confirmPcHostKey(pcId: string, candidate: HostKeyCandidate, fingerprint: string): Promise<PcSshSettings> {
  return mutateSettings(pcId, '/host-key', 'POST', { ...candidate, fingerprint: fingerprint.trim() })
}

export function testPcSshConnection(pcId: string): Promise<PcSshSettings> {
  return mutateSettings(pcId, '/test', 'POST')
}
