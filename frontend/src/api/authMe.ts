import type { ApiActorMeResponse } from '../types/models'
import { request } from './http'

export function getCurrentApiActor(bearerToken?: string): Promise<ApiActorMeResponse> {
  if (!bearerToken) {
    return request<ApiActorMeResponse>('/api/auth/me')
  }
  return request<ApiActorMeResponse>('/api/auth/me', {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
}
