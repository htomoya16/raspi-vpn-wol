import { request } from './http'

function toQueryString(params) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

export function listPcs(params = {}) {
  const query = toQueryString(params)
  return request(`/api/pcs${query}`)
}

export function createPc(payload) {
  return request('/api/pcs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deletePc(pcId) {
  return request(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'DELETE',
  })
}

export function updatePc(pcId, payload) {
  return request(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function refreshPcStatus(pcId) {
  return request(`/api/pcs/${encodeURIComponent(pcId)}/status/refresh`, {
    method: 'POST',
  })
}

export function refreshAllStatuses() {
  return request('/api/pcs/status/refresh', {
    method: 'POST',
  })
}

export function sendPcWol(pcId, payload = null) {
  const options = {
    method: 'POST',
  }

  if (payload && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(payload)
  }

  return request(`/api/pcs/${encodeURIComponent(pcId)}/wol`, options)
}
