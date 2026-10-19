import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  advanceAuthGeneration,
  apiFetch,
  ensureCsrf,
  resetAuthClientForTests,
  setUnauthorizedHandler,
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

describe('api client session invalidation', () => {
  beforeEach(() => {
    resetAuthClientForTests()
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

  it('ignores a delayed 401 after logout and a new login generation', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    const deferred = createDeferred<Response>()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementationOnce(() => deferred.promise)

    const pending = expect(
      apiFetch('/api/v1/households/hh/accounts'),
    ).rejects.toMatchObject({ status: 401 })
    advanceAuthGeneration()
    advanceAuthGeneration()

    deferred.resolve(jsonResponse({ detail: 'Unauthorized' }, { status: 401 }))
    await pending
    expect(onUnauthorized).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
    )
    await expect(apiFetch('/api/v1/auth/me')).rejects.toMatchObject({
      status: 401,
    })
    expect(onUnauthorized).toHaveBeenCalledWith({ path: '/api/v1/auth/me' })
  })

  it('does not clear the new session CSRF on a delayed prior-session 403', async () => {
    const fetchMock = vi.mocked(fetch)
    const deferred = createDeferred<Response>()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'old-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockImplementationOnce(() => deferred.promise)

    const pending = expect(
      apiFetch('/api/v1/households/hh/expenses', {
        method: 'POST',
        csrf: true,
        body: { amount: '10' },
      }),
    ).rejects.toMatchObject({ status: 403 })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    advanceAuthGeneration()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'new-token', headerName: 'X-CSRF-TOKEN' }),
    )
    await expect(ensureCsrf()).resolves.toMatchObject({ token: 'new-token' })

    deferred.resolve(
      jsonResponse(
        { detail: 'Forbidden', code: 'CSRF' },
        { status: 403, statusText: 'Forbidden' },
      ),
    )
    await pending

    await expect(ensureCsrf()).resolves.toMatchObject({ token: 'new-token' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not dispatch a CSRF write after the auth generation changes', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'csrf', headerName: 'X-CSRF-TOKEN' }),
    )
    await ensureCsrf()
    fetchMock.mockClear()

    const pending = expect(
      apiFetch('/api/v1/households/hh/expenses', {
        method: 'POST',
        csrf: true,
        body: { amount: '10' },
      }),
    ).rejects.toBeInstanceOf(TypeError)

    advanceAuthGeneration()
    await pending

    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/households/hh/expenses'),
      ),
    ).toBe(false)
  })
})
