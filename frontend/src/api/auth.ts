export const API_BEARER_STORAGE_KEY = 'wol:api-bearer-token'
export const API_BEARER_STORAGE_EVENT = 'wol:api-bearer-token-changed'
export const API_BEARER_INVALID_EVENT = 'wol:api-bearer-token-invalid'

function readFromStorage(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  try {
    return window.localStorage.getItem(API_BEARER_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function getStoredBearerToken(): string {
  return readFromStorage()
}

export function setStoredBearerToken(token: string): void {
  if (typeof window === 'undefined') {
    return
  }
  const normalized = token.trim()
  try {
    if (normalized) {
      window.localStorage.setItem(API_BEARER_STORAGE_KEY, normalized)
      window.dispatchEvent(new CustomEvent(API_BEARER_STORAGE_EVENT))
      return
    }
    window.localStorage.removeItem(API_BEARER_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(API_BEARER_STORAGE_EVENT))
  } catch {
    // noop
  }
}
