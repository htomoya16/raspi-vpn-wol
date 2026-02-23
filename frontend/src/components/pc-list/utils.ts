import type { Pc, PcUpdatePayload } from '../../types/models'
import { EMPTY_EDIT_FORM, type PcEditFormState } from './constants'

export function toEditForm(pc: Pc | null): PcEditFormState {
  if (!pc) {
    return EMPTY_EDIT_FORM
  }

  return {
    name: pc.name || '',
    mac: pc.mac || '',
    ip: pc.ip || '',
    tags: (pc.tags || []).join(', '),
    note: pc.note || '',
  }
}

export function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function toUpdatePayload(form: PcEditFormState): PcUpdatePayload {
  return {
    name: form.name.trim(),
    mac: form.mac.trim(),
    ip: form.ip.trim() || null,
    tags: parseTags(form.tags),
    note: form.note.trim() || null,
  }
}
