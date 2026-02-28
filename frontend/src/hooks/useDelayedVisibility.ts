import { useEffect, useState } from 'react'

export function useDelayedVisibility(active: boolean, delayMs = 200): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(active)
    }, active ? delayMs : 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [active, delayMs])

  return visible
}
