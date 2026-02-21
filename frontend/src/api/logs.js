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

export function listLogs(params = {}) {
  const query = toQueryString(params)
  return request(`/api/logs${query}`)
}
