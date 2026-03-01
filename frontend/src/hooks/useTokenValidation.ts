import { useEffect, useRef, useState } from 'react'

import { getCurrentApiActor } from '../api/authMe'
import {
  API_BEARER_INVALID_EVENT,
  API_BEARER_STORAGE_EVENT,
  API_BEARER_STORAGE_KEY,
  getStoredBearerToken,
} from '../api/auth'
import type { ApiActorMeResponse } from '../types/models'

const TOKEN_REVALIDATE_INTERVAL_MS = 60_000

interface TokenValidationState {
  token: string
  valid: boolean
  tokenName: string
  tokenRole: ApiActorMeResponse['token_role'] | null
}

export interface UseTokenValidationResult {
  storedBearerToken: string
  hasBearerToken: boolean
  isTokenVerified: boolean
  isTokenValidationPending: boolean
  isTokenInvalid: boolean
  activeTokenName: string
  activeTokenRole: ApiActorMeResponse['token_role'] | null
}

export function useTokenValidation(): UseTokenValidationResult {
  const [storedBearerToken, setStoredBearerTokenState] = useState(() => getStoredBearerToken())
  const lastTokenValidationAtRef = useRef(0)
  const [tokenValidation, setTokenValidation] = useState<TokenValidationState | null>(null)
  const hasBearerToken = Boolean(storedBearerToken)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const syncTokenState = () => {
      setStoredBearerTokenState(getStoredBearerToken())
    }
    syncTokenState()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === API_BEARER_STORAGE_KEY) {
        syncTokenState()
      }
    }
    const handleInvalidToken = () => {
      const currentToken = getStoredBearerToken().trim()
      if (!currentToken) {
        return
      }
      setTokenValidation({
        token: currentToken,
        valid: false,
        tokenName: '',
        tokenRole: null,
      })
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(API_BEARER_STORAGE_EVENT, syncTokenState)
    window.addEventListener(API_BEARER_INVALID_EVENT, handleInvalidToken)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(API_BEARER_STORAGE_EVENT, syncTokenState)
      window.removeEventListener(API_BEARER_INVALID_EVENT, handleInvalidToken)
    }
  }, [])

  useEffect(() => {
    if (!hasBearerToken) {
      return
    }

    let cancelled = false
    lastTokenValidationAtRef.current = Date.now()
    void getCurrentApiActor(storedBearerToken)
      .then((actor) => {
        if (cancelled) {
          return
        }
        setTokenValidation({
          token: storedBearerToken,
          valid: true,
          tokenName: actor.token_name,
          tokenRole: actor.token_role,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setTokenValidation({
          token: storedBearerToken,
          valid: false,
          tokenName: '',
          tokenRole: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [hasBearerToken, storedBearerToken])

  const isTokenVerified = Boolean(
    storedBearerToken &&
      tokenValidation &&
      tokenValidation.token === storedBearerToken &&
      tokenValidation.valid,
  )

  useEffect(() => {
    if (!isTokenVerified || typeof window === 'undefined') {
      return
    }

    let cancelled = false
    const verifyToken = async () => {
      lastTokenValidationAtRef.current = Date.now()
      try {
        const actor = await getCurrentApiActor(storedBearerToken)
        if (cancelled) {
          return
        }
        setTokenValidation({
          token: storedBearerToken,
          valid: true,
          tokenName: actor.token_name,
          tokenRole: actor.token_role,
        })
      } catch {
        if (cancelled) {
          return
        }
        setTokenValidation({
          token: storedBearerToken,
          valid: false,
          tokenName: '',
          tokenRole: null,
        })
      }
    }

    const verifyTokenIfDue = () => {
      const elapsed = Date.now() - lastTokenValidationAtRef.current
      if (elapsed < TOKEN_REVALIDATE_INTERVAL_MS) {
        return
      }
      void verifyToken()
    }

    const timerId = window.setInterval(() => {
      void verifyToken()
    }, TOKEN_REVALIDATE_INTERVAL_MS)

    const handleWindowFocus = () => {
      verifyTokenIfDue()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyTokenIfDue()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      window.clearInterval(timerId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isTokenVerified, storedBearerToken])

  const isTokenValidationPending = Boolean(storedBearerToken && tokenValidation?.token !== storedBearerToken)
  const isTokenInvalid = Boolean(
    storedBearerToken &&
      tokenValidation &&
      tokenValidation.token === storedBearerToken &&
      !tokenValidation.valid,
  )
  const activeTokenName = isTokenVerified ? tokenValidation?.tokenName ?? '' : ''
  const activeTokenRole = isTokenVerified ? tokenValidation?.tokenRole ?? null : null

  return {
    storedBearerToken,
    hasBearerToken,
    isTokenVerified,
    isTokenValidationPending,
    isTokenInvalid,
    activeTokenName,
    activeTokenRole,
  }
}
