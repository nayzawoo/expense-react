import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import {
  advanceAuthGeneration,
  apiFetch,
  ensureCsrf,
  resetAuthClientForTests,
} from '@/api/client'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('api client', () => {
  beforeEach(() => {
    resetAuthClientForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('bootstraps and caches the CSRF token', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
    )

    const first = await ensureCsrf()
    const second = await ensureCsrf()

    expect(first).toEqual({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' })
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('attaches the CSRF header on unsafe requests', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await apiFetch<{ ok: boolean }>('/api/v1/auth/login', {
      method: 'POST',
      csrf: true,
      body: { email: 'member@example.com', password: 'password-example' },
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const loginCall = fetchMock.mock.calls[1]
    expect(loginCall?.[0]).toBe('/api/v1/auth/login')
    const init = loginCall?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('X-CSRF-TOKEN')).toBe('csrf-token')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe(
      JSON.stringify({
        email: 'member@example.com',
        password: 'password-example',
      }),
    )
  })

  it('maps failed JSON responses to ApiError and clears CSRF on 403 writes', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { detail: 'Forbidden', code: 'CSRF' },
          { status: 403, statusText: 'Forbidden' },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: 'fresh-token', headerName: 'X-CSRF-TOKEN' }),
      )

    await expect(
      apiFetch('/api/v1/auth/logout', { method: 'POST', csrf: true }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Forbidden',
      code: 'CSRF',
    } satisfies Partial<ApiError>)

    const next = await ensureCsrf()
    expect(next.token).toBe('fresh-token')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns undefined for 204 responses', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(
      apiFetch<void>('/api/v1/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined()
  })

  it('does not cache a CSRF token after the auth generation advances', async () => {
    const fetchMock = vi.mocked(fetch)
    const deferred = createDeferred<Response>()
    fetchMock.mockImplementationOnce(() => deferred.promise)

    const pending = expect(ensureCsrf()).rejects.toBeInstanceOf(TypeError)
    advanceAuthGeneration()
    deferred.resolve(
      jsonResponse({ token: 'stale-token', headerName: 'X-CSRF-TOKEN' }),
    )

    await pending

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'fresh-token', headerName: 'X-CSRF-TOKEN' }),
    )
    const next = await ensureCsrf()
    expect(next.token).toBe('fresh-token')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
