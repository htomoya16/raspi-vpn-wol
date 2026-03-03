import type { Pc, PcFilterState } from '../../types/models'

export function matchesPcFilters(pc: Pc, filters: PcFilterState): boolean {
  const normalizedQuery = filters.q.trim().toLowerCase()
  if (normalizedQuery) {
    const haystacks = [pc.id, pc.name, pc.mac, pc.ip, ...(pc.tags || []), pc.note || ''].map((value) =>
      value.toLowerCase(),
    )
    const matched = haystacks.some((value) => value.includes(normalizedQuery))
    if (!matched) {
      return false
    }
  }

  if (filters.status && pc.status !== filters.status) {
    return false
  }

  return true
}
