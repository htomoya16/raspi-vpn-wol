import type {
  ApiTokenCreatePayload,
  ApiTokenCreateResponse,
  ApiTokenDeleteResponse,
  ApiTokenListResponse,
  ApiTokenRevokeResponse,
} from '../types/models'
import { request } from './http'

export function listApiTokens(): Promise<ApiTokenListResponse> {
  return request<ApiTokenListResponse>('/api/admin/tokens')
}

export function createApiToken(payload: ApiTokenCreatePayload): Promise<ApiTokenCreateResponse> {
  return request<ApiTokenCreateResponse>('/api/admin/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function revokeApiToken(tokenId: string): Promise<ApiTokenRevokeResponse> {
  return request<ApiTokenRevokeResponse>(`/api/admin/tokens/${encodeURIComponent(tokenId)}/revoke`, {
    method: 'POST',
  })
}

export function deleteApiToken(tokenId: string): Promise<ApiTokenDeleteResponse> {
  return request<ApiTokenDeleteResponse>(`/api/admin/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  })
}
