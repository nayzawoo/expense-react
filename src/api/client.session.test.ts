import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiFetch,
  clearCsrf,
  setUnauthorizedHandler,
} from '@/api/client'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('api client session invalidation', () => {
  beforeEach(() => {
    clearCsrf()
    setUnauthorizedHandler(null)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
    vi.unstubAllGlobals()
  })

  it('notifies and clears CSRF on protected-request 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
    )

    await expect(apiFetch('/api/v1/auth/me')).rejects.toMatchObject({
      status: 401,
    })
    expect(onUnauthorized).toHaveBeenCalledWith({ path: '/api/v1/auth/me' })
  })

  it('does not invalidate the session on login 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
      )

    await expect(
      apiFetch('/api/v1/auth/login', {
        method: 'POST',
        csrf: true,
        body: { email: 'a@example.com', password: 'bad' },
      }),
    ).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not invalidate the session on wrong current-password 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
      )

    await expect(
      apiFetch('/api/v1/password', {
        method: 'PUT',
        csrf: true,
        body: { currentPassword: 'wrong', newPassword: 'new-password' },
      }),
    ).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
