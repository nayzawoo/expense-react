import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { login, logout, reportQualifyingActivity } from '@/api/auth'
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

  it('still returns the user when post-login CSRF refresh fails', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'pre-login', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(jsonResponse(sampleUser))
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'csrf down' }, { status: 500 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: 'recovered', headerName: 'X-CSRF-TOKEN' }),
      )

    const user = await login('member@example.com', 'password-example')
    expect(user).toEqual(sampleUser)

    const recovered = await ensureCsrf()
    expect(recovered.token).toBe('recovered')
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

  it('does not clear CSRF when logout fails', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'logout-csrf', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'logout failed' }, { status: 500 }),
      )

    await expect(logout()).rejects.toMatchObject({ status: 500 })

    const cached = await ensureCsrf()
    expect(cached.token).toBe('logout-csrf')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('posts CSRF-protected qualifying activity', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'act-csrf', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await reportQualifyingActivity()

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/activity')
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('act-csrf')
    expect(init.method).toBe('POST')
  })
})
