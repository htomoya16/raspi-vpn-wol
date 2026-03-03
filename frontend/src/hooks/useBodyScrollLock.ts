import { useEffect, useRef } from 'react'

type ScrollLockStrategy = 'overflow' | 'fixed'

interface ScrollLockOptions {
  strategy?: ScrollLockStrategy
}

interface BodyStyleSnapshot {
  overflow: string
  position: string
  top: string
  left: string
  right: string
  width: string
  paddingRight: string
}

const activeLocks = new Map<symbol, ScrollLockStrategy>()
let originalStyle: BodyStyleSnapshot | null = null
let fixedScrollY = 0
let hadFixedLock = false

function safeRestoreScrollPosition(scrollY: number): void {
  if (typeof window === 'undefined') {
    return
  }
  const userAgent = window.navigator?.userAgent ?? ''
  if (userAgent.toLowerCase().includes('jsdom')) {
    return
  }
  try {
    window.scrollTo(0, scrollY)
  } catch {
    // jsdom may not implement scrollTo
  }
}

function captureOriginalStyle(): void {
  if (typeof document === 'undefined' || originalStyle) {
    return
  }
  const body = document.body
  originalStyle = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  }
}

function applySnapshot(snapshot: BodyStyleSnapshot): void {
  if (typeof document === 'undefined') {
    return
  }
  const body = document.body
  body.style.overflow = snapshot.overflow
  body.style.position = snapshot.position
  body.style.top = snapshot.top
  body.style.left = snapshot.left
  body.style.right = snapshot.right
  body.style.width = snapshot.width
  body.style.paddingRight = snapshot.paddingRight
}

function currentStrategy(): ScrollLockStrategy | null {
  if (activeLocks.size === 0) {
    return null
  }
  for (const strategy of activeLocks.values()) {
    if (strategy === 'fixed') {
      return 'fixed'
    }
  }
  return 'overflow'
}

function syncBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const strategy = currentStrategy()
  if (!strategy) {
    if (originalStyle) {
      applySnapshot(originalStyle)
      if (hadFixedLock) {
        safeRestoreScrollPosition(fixedScrollY)
      }
    }
    originalStyle = null
    fixedScrollY = 0
    hadFixedLock = false
    return
  }

  captureOriginalStyle()
  if (!originalStyle) {
    return
  }

  applySnapshot(originalStyle)

  const body = document.body
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

  if (strategy === 'overflow') {
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }
    return
  }

  fixedScrollY = window.scrollY
  hadFixedLock = true
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${fixedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
}

export function useBodyScrollLock(locked: boolean, options: ScrollLockOptions = {}): void {
  const strategy = options.strategy ?? 'overflow'
  const lockIdRef = useRef<symbol | null>(null)

  if (lockIdRef.current == null) {
    lockIdRef.current = Symbol('body-scroll-lock')
  }

  useEffect(() => {
    const lockId = lockIdRef.current
    if (!lockId) {
      return
    }

    if (locked) {
      activeLocks.set(lockId, strategy)
    } else {
      activeLocks.delete(lockId)
    }
    syncBodyScrollLock()

    return () => {
      activeLocks.delete(lockId)
      syncBodyScrollLock()
    }
  }, [locked, strategy])
}
