import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { login, logout } from '@/api/auth'
import { clearCsrf, ensureCsrf } from '@/api/client'
import { sampleUser } from '@/test/fixtures'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('auth api helpers', () => {
  beforeEach(() => {
    clearCsrf()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes CSRF after a successful login', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'pre-login', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(jsonResponse(sampleUser))
      .mockResolvedValueOnce(
        jsonResponse({ token: 'post-login', headerName: 'X-CSRF-TOKEN' }),
      )

    const user = await login('member@example.com', 'password-example')

    expect(user).toEqual(sampleUser)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/csrf')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/login')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/v1/auth/csrf')

    const cached = await ensureCsrf()
    expect(cached.token).toBe('post-login')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('clears CSRF after logout', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'logout-csrf', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({ token: 'anonymous-csrf', headerName: 'X-CSRF-TOKEN' }),
      )

    await logout()
    const next = await ensureCsrf()

    expect(next.token).toBe('anonymous-csrf')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
