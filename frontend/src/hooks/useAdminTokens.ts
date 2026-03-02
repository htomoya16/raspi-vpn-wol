import { useCallback, useEffect, useMemo, useReducer } from 'react'

import { createApiToken, deleteApiToken, listApiTokens, revokeApiToken } from '../api/adminTokens'
import { getCurrentApiActor } from '../api/authMe'
import { getStoredBearerToken, setStoredBearerToken } from '../api/auth'
import { ApiError, formatApiError } from '../api/http'
import type { ApiToken } from '../types/models'

export interface BearerFeedback {
  kind: 'success' | 'error' | 'cleared'
  message: string
}

export interface CreateFeedback {
  kind: 'success' | 'error'
  message: string
}

export interface UseAdminTokensResult {
  apiTokens: ApiToken[]
  tokensLoading: boolean
  tokensError: string
  tokenAccessDenied: boolean
  currentBearerToken: string
  bearerSaving: boolean
  bearerFeedback: BearerFeedback | null
  createName: string
  createRole: 'device' | 'admin'
  createExpiresAt: string
  createLoading: boolean
  createError: string
  createFeedback: CreateFeedback | null
  createdPlainToken: string
  revokingTokenId: string | null
  deletingTokenId: string | null
  deleteTargetToken: ApiToken | null
  activeTokenCount: number
  setCurrentBearerToken: (value: string) => void
  setCreateName: (value: string) => void
  setCreateRole: (value: 'device' | 'admin') => void
  setCreateExpiresAt: (value: string) => void
  clearBearerFeedback: () => void
  clearCreateFeedback: () => void
  setCreateFeedback: (feedback: CreateFeedback | null) => void
  loadTokens: () => Promise<void>
  handleSaveBearerToken: () => Promise<void>
  handleClearBearerToken: () => void
  handleCreateToken: () => Promise<void>
  handleCopyCreatedToken: () => Promise<{ ok: boolean; message: string }>
  handleRevokeToken: (tokenId: string) => Promise<void>
  handleOpenDeleteDialog: (token: ApiToken) => void
  handleCloseDeleteDialog: () => void
  handleDeleteToken: () => Promise<void>
}

interface AdminTokensState {
  apiTokens: ApiToken[]
  tokensLoading: boolean
  tokensError: string
  tokenAccessDenied: boolean
  currentBearerToken: string
  bearerSaving: boolean
  bearerFeedback: BearerFeedback | null
  createName: string
  createRole: 'device' | 'admin'
  createExpiresAt: string
  createLoading: boolean
  createError: string
  createFeedback: CreateFeedback | null
  createdPlainToken: string
  revokingTokenId: string | null
  deletingTokenId: string | null
  deleteTargetToken: ApiToken | null
}

type AdminTokensAction =
  | { type: 'patch'; payload: Partial<AdminTokensState> }
  | { type: 'setCreateRole'; payload: 'device' | 'admin' }

function createInitialState(): AdminTokensState {
  return {
    apiTokens: [],
    tokensLoading: false,
    tokensError: '',
    tokenAccessDenied: false,
    currentBearerToken: getStoredBearerToken(),
    bearerSaving: false,
    bearerFeedback: null,
    createName: '',
    createRole: 'device',
    createExpiresAt: '',
    createLoading: false,
    createError: '',
    createFeedback: null,
    createdPlainToken: '',
    revokingTokenId: null,
    deletingTokenId: null,
    deleteTargetToken: null,
  }
}

function adminTokensReducer(state: AdminTokensState, action: AdminTokensAction): AdminTokensState {
  if (action.type === 'patch') {
    return { ...state, ...action.payload }
  }

  if (action.type === 'setCreateRole') {
    return { ...state, createRole: action.payload }
  }

  return state
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false
  }
  const timestamp = Date.parse(expiresAt)
  if (Number.isNaN(timestamp)) {
    return false
  }
  return timestamp <= Date.now()
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  if (typeof document === 'undefined') {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

export function useAdminTokens(active: boolean): UseAdminTokensResult {
  const [state, dispatch] = useReducer(adminTokensReducer, undefined, createInitialState)

  const {
    apiTokens,
    tokensLoading,
    tokensError,
    tokenAccessDenied,
    currentBearerToken,
    bearerSaving,
    bearerFeedback,
    createName,
    createRole,
    createExpiresAt,
    createLoading,
    createError,
    createFeedback,
    createdPlainToken,
    revokingTokenId,
    deletingTokenId,
    deleteTargetToken,
  } = state

  const loadTokens = useCallback(async () => {
    dispatch({ type: 'patch', payload: { tokensLoading: true, tokensError: '' } })
    try {
      const response = await listApiTokens()
      dispatch({
        type: 'patch',
        payload: {
          apiTokens: response.items,
          tokenAccessDenied: false,
        },
      })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        dispatch({
          type: 'patch',
          payload: {
            apiTokens: [],
            tokenAccessDenied: true,
            tokensError: '',
          },
        })
        return
      }
      dispatch({
        type: 'patch',
        payload: {
          tokenAccessDenied: false,
          tokensError: formatApiError(error),
        },
      })
    } finally {
      dispatch({ type: 'patch', payload: { tokensLoading: false } })
    }
  }, [])

  useEffect(() => {
    if (active) {
      void loadTokens()
    }
  }, [active, loadTokens])

  const activeTokenCount = useMemo(
    () => apiTokens.filter((token) => token.revoked_at == null && !isExpired(token.expires_at)).length,
    [apiTokens],
  )

  const handleSaveBearerToken = useCallback(async () => {
    const normalized = currentBearerToken.trim()
    if (!normalized) {
      dispatch({
        type: 'patch',
        payload: { bearerFeedback: { kind: 'error', message: '保存するBearerトークンを入力してください。' } },
      })
      return
    }

    dispatch({ type: 'patch', payload: { bearerSaving: true } })
    try {
      await getCurrentApiActor(normalized)
      setStoredBearerToken(normalized)
      dispatch({
        type: 'patch',
        payload: {
          currentBearerToken: normalized,
          bearerFeedback: { kind: 'success', message: 'Bearerトークンを保存しました。' },
        },
      })
      if (active) {
        await loadTokens()
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        dispatch({
          type: 'patch',
          payload: { bearerFeedback: { kind: 'error', message: 'Bearerトークンが無効です。' } },
        })
      } else {
        dispatch({
          type: 'patch',
          payload: { bearerFeedback: { kind: 'error', message: formatApiError(error) } },
        })
      }
    } finally {
      dispatch({ type: 'patch', payload: { bearerSaving: false } })
    }
  }, [active, currentBearerToken, loadTokens])

  const handleClearBearerToken = useCallback(() => {
    setStoredBearerToken('')
    dispatch({
      type: 'patch',
      payload: {
        currentBearerToken: '',
        createdPlainToken: '',
        apiTokens: [],
        tokenAccessDenied: true,
        tokensError: '',
        bearerFeedback: { kind: 'cleared', message: 'Bearerトークンをクリアしました。' },
      },
    })
  }, [])

  const handleCreateToken = useCallback(async () => {
    const normalizedName = createName.trim()
    if (!normalizedName) {
      dispatch({ type: 'patch', payload: { createError: '端末名を入力してください' } })
      return
    }

    let expiresAt: string | null = null
    if (createExpiresAt.trim()) {
      const parsed = new Date(createExpiresAt)
      if (Number.isNaN(parsed.getTime())) {
        dispatch({
          type: 'patch',
          payload: { createError: '有効期限は日時として解釈できる値を入力してください' },
        })
        return
      }
      expiresAt = parsed.toISOString()
    }

    dispatch({
      type: 'patch',
      payload: {
        createLoading: true,
        createError: '',
        createFeedback: null,
      },
    })

    try {
      const response = await createApiToken({
        name: normalizedName,
        role: createRole,
        expires_at: expiresAt,
      })
      dispatch({
        type: 'patch',
        payload: {
          createdPlainToken: response.plain_token,
          createFeedback: {
            kind: 'success',
            message: 'トークンを発行しました。利用する場合は入力欄に貼り付けて保存してください。',
          },
          createName: '',
          createRole: 'device',
          createExpiresAt: '',
        },
      })
      await loadTokens()
    } catch (error) {
      dispatch({ type: 'patch', payload: { createError: formatApiError(error) } })
    } finally {
      dispatch({ type: 'patch', payload: { createLoading: false } })
    }
  }, [createExpiresAt, createName, createRole, loadTokens])

  const handleCopyCreatedToken = useCallback(async () => {
    if (!createdPlainToken) {
      return { ok: false, message: '平文トークンがありません。' }
    }
    try {
      const copied = await copyTextToClipboard(createdPlainToken)
      if (!copied) {
        return { ok: false, message: '平文トークンのコピーに失敗しました。手動でコピーしてください。' }
      }
      return { ok: true, message: '平文トークンをコピーしました。' }
    } catch {
      return { ok: false, message: '平文トークンのコピーに失敗しました。手動でコピーしてください。' }
    }
  }, [createdPlainToken])

  const handleRevokeToken = useCallback(
    async (tokenId: string) => {
      dispatch({ type: 'patch', payload: { revokingTokenId: tokenId, tokensError: '' } })
      try {
        await revokeApiToken(tokenId)
        await loadTokens()
      } catch (error) {
        dispatch({ type: 'patch', payload: { tokensError: formatApiError(error) } })
      } finally {
        dispatch({ type: 'patch', payload: { revokingTokenId: null } })
      }
    },
    [loadTokens],
  )

  const handleOpenDeleteDialog = useCallback((token: ApiToken) => {
    dispatch({
      type: 'patch',
      payload: {
        deleteTargetToken: token,
        tokensError: '',
      },
    })
  }, [])

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletingTokenId != null) {
      return
    }
    dispatch({ type: 'patch', payload: { deleteTargetToken: null } })
  }, [deletingTokenId])

  const handleDeleteToken = useCallback(async () => {
    if (deleteTargetToken == null) {
      return
    }

    dispatch({
      type: 'patch',
      payload: {
        deletingTokenId: deleteTargetToken.id,
        tokensError: '',
      },
    })

    try {
      await deleteApiToken(deleteTargetToken.id)
      dispatch({ type: 'patch', payload: { deleteTargetToken: null } })
      await loadTokens()
    } catch (error) {
      dispatch({ type: 'patch', payload: { tokensError: formatApiError(error) } })
    } finally {
      dispatch({ type: 'patch', payload: { deletingTokenId: null } })
    }
  }, [deleteTargetToken, loadTokens])

  const setCurrentBearerToken = useCallback((value: string) => {
    dispatch({ type: 'patch', payload: { currentBearerToken: value } })
  }, [])

  const setCreateName = useCallback((value: string) => {
    dispatch({ type: 'patch', payload: { createName: value } })
  }, [])

  const setCreateRole = useCallback((value: 'device' | 'admin') => {
    dispatch({ type: 'setCreateRole', payload: value })
  }, [])

  const setCreateExpiresAt = useCallback((value: string) => {
    dispatch({ type: 'patch', payload: { createExpiresAt: value } })
  }, [])

  const clearBearerFeedback = useCallback(() => {
    dispatch({ type: 'patch', payload: { bearerFeedback: null } })
  }, [])

  const clearCreateFeedback = useCallback(() => {
    dispatch({ type: 'patch', payload: { createFeedback: null } })
  }, [])

  const setCreateFeedback = useCallback((feedback: CreateFeedback | null) => {
    dispatch({ type: 'patch', payload: { createFeedback: feedback } })
  }, [])

  return {
    apiTokens,
    tokensLoading,
    tokensError,
    tokenAccessDenied,
    currentBearerToken,
    bearerSaving,
    bearerFeedback,
    createName,
    createRole,
    createExpiresAt,
    createLoading,
    createError,
    createFeedback,
    createdPlainToken,
    revokingTokenId,
    deletingTokenId,
    deleteTargetToken,
    activeTokenCount,
    setCurrentBearerToken,
    setCreateName,
    setCreateRole,
    setCreateExpiresAt,
    clearBearerFeedback,
    clearCreateFeedback,
    setCreateFeedback,
    loadTokens,
    handleSaveBearerToken,
    handleClearBearerToken,
    handleCreateToken,
    handleCopyCreatedToken,
    handleRevokeToken,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteToken,
  }
}
