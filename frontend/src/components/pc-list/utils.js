import { EMPTY_EDIT_FORM } from './constants'

export function toEditForm(pc) {
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

export function parseTags(text) {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}
