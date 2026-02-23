import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const getSnapshot = (): boolean => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia(query).matches
  }

  const subscribe = (onStoreChange: () => void): (() => void) => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    const media = window.matchMedia(query)
    const handleChange = () => {
      onStoreChange()
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
    } else {
      media.addListener(handleChange)
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleChange)
      } else {
        media.removeListener(handleChange)
      }
    }
  }

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
