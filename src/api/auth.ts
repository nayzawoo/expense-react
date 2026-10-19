import { apiFetch, clearCsrf, ensureCsrf } from '@/api/client'
import type { CurrentUser } from '@/api/types'

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/api/v1/auth/me')
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const user = await apiFetch<CurrentUser>('/api/v1/auth/login', {
    method: 'POST',
    csrf: true,
    body: { email, password },
  })
  // Login rotates the session id and CSRF token.
  clearCsrf()
  await ensureCsrf()
  return user
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/logout', {
    method: 'POST',
    csrf: true,
  })
  clearCsrf()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<void>('/api/v1/password', {
    method: 'PUT',
    csrf: true,
    body: { currentPassword, newPassword },
  })
  clearCsrf()
}
