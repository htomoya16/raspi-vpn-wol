import type { Pc, PcStatus } from '../../types/models'

export const STATUS_LABELS: Record<PcStatus, string> = {
  online: 'オンライン',
  offline: 'オフライン',
  unknown: '不明',
  booting: '起動中',
  unreachable: '到達不能',
}

export interface PcEditFormState {
  name: string
  mac: string
  ip: string
  tags: string
  note: string
}

export const EMPTY_EDIT_FORM: PcEditFormState = {
  name: '',
  mac: '',
  ip: '',
  tags: '',
  note: '',
}

export type PcListItem = Pc
