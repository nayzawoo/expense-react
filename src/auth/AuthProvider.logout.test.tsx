import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { apiFetch, getAuthGeneration, resetAuthClientForTests } from '@/api/client'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { sampleAdmin, sampleHousehold, sampleUser } from '@/test/fixtures'

const fetchCurrentUserMock = vi.fn()
const loginMock = vi.fn()
const logoutMock = vi.fn()
const changePasswordMock = vi.fn()
const fetchHouseholdMock = vi.fn()

vi.mock('@/api/auth', () => ({
  fetchCurrentUser: (...args: unknown[]) => fetchCurrentUserMock(...args),
  login: (...args: unknown[]) => loginMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
  reportQualifyingActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/household', () => ({
  fetchHousehold: (...args: unknown[]) => fetchHouseholdMock(...args),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function SessionProbe() {
  const {
    status,
    user,
    household,
    error,
    logout,
    login,
    changePassword,
    refreshSession,
  } = useAuth()
  return (
    <div>
      <p>status:{status}</p>
      <p>user:{user?.email ?? 'none'}</p>
      <p>household:{household?.name ?? 'none'}</p>
      <p>error:{error ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          void logout().catch(() => undefined)
        }}
      >
        Sign out
      </button>
      <button
        type="button"
        onClick={() => {
          void login('admin@example.com', 'password-example').catch(
            () => undefined,
          )
        }}
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => {
          void changePassword('current-password', 'new-password-1').catch(
            () => undefined,
          )
        }}
      >
        Change password
      </button>
      <button
        type="button"
        onClick={() => {
          void refreshSession()
        }}
      >
        Refresh
      </button>
    </div>
  )
}

describe('AuthProvider logout', () => {
  beforeEach(() => {
    resetAuthClientForTests()
    fetchCurrentUserMock.mockReset()
    loginMock.mockReset()
    logoutMock.mockReset()
    changePasswordMock.mockReset()
    fetchHouseholdMock.mockReset()
    fetchCurrentUserMock.mockResolvedValue(sampleUser)
    fetchHouseholdMock.mockResolvedValue(sampleHousehold)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the authenticated session when logout fails', async () => {
    const user = userEvent.setup()
    logoutMock.mockRejectedValue(new Error('logout boom'))

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(screen.getByText(/error:logout boom/)).toBeInTheDocument()
    })
    expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    expect(screen.getByText(`user:${sampleUser.email}`)).toBeInTheDocument()
    expect(screen.getByText(`household:${sampleHousehold.name}`)).toBeInTheDocument()
  })

  it('clears auth only after logout succeeds', async () => {
    const user = userEvent.setup()
    logoutMock.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign out' }))
    })

    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })
    expect(screen.getByText('user:none')).toBeInTheDocument()
    expect(screen.getByText('household:none')).toBeInTheDocument()
  })

  it('does not restore auth when a deferred refresh finishes after logout', async () => {
    const user = userEvent.setup()
    const deferredUser = createDeferred<typeof sampleUser>()
    const deferredHousehold = createDeferred<typeof sampleHousehold>()
    logoutMock.mockResolvedValue(undefined)
    fetchCurrentUserMock
      .mockResolvedValueOnce(sampleUser)
      .mockImplementationOnce(() => deferredUser.promise)
    fetchHouseholdMock
      .mockResolvedValueOnce(sampleHousehold)
      .mockImplementationOnce(() => deferredHousehold.promise)

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    })
    const generationAfterLogin = getAuthGeneration()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(fetchCurrentUserMock).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign out' }))
    })

    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })
    expect(getAuthGeneration()).toBeGreaterThan(generationAfterLogin)

    await act(async () => {
      deferredUser.resolve(sampleUser)
      deferredHousehold.resolve(sampleHousehold)
    })

    expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    expect(screen.getByText('user:none')).toBeInTheDocument()
    expect(screen.getByText('household:none')).toBeInTheDocument()
  })

  it('does not restore household when a deferred household load finishes after logout', async () => {
    const user = userEvent.setup()
    const deferredHousehold = createDeferred<typeof sampleHousehold>()
    logoutMock.mockResolvedValue(undefined)
    fetchCurrentUserMock
      .mockResolvedValueOnce(sampleUser)
      .mockResolvedValueOnce(sampleUser)
    fetchHouseholdMock
      .mockResolvedValueOnce(sampleHousehold)
      .mockImplementationOnce(() => deferredHousehold.promise)

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(`household:${sampleHousehold.name}`)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(fetchHouseholdMock).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })

    await act(async () => {
      deferredHousehold.resolve(sampleHousehold)
    })

    expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    expect(screen.getByText('user:none')).toBeInTheDocument()
    expect(screen.getByText('household:none')).toBeInTheDocument()
  })

  it('does not restore auth when a deferred refresh finishes after password change', async () => {
    const user = userEvent.setup()
    const deferredUser = createDeferred<typeof sampleUser>()
    changePasswordMock.mockResolvedValue(undefined)
    fetchCurrentUserMock
      .mockResolvedValueOnce(sampleUser)
      .mockImplementationOnce(() => deferredUser.promise)
    fetchHouseholdMock.mockResolvedValue(sampleHousehold)

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(fetchCurrentUserMock).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Change password' }))
    })
    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })

    await act(async () => {
      deferredUser.resolve(sampleUser)
    })

    expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    expect(screen.getByText('user:none')).toBeInTheDocument()
    expect(screen.getByText('household:none')).toBeInTheDocument()
  })

  it('ignores a delayed 401 from before logout after a successful new login', async () => {
    const user = userEvent.setup()
    const deferredResponse = createDeferred<Response>()
    logoutMock.mockResolvedValue(undefined)
    loginMock.mockResolvedValue(sampleAdmin)
    fetchHouseholdMock
      .mockResolvedValueOnce(sampleHousehold)
      .mockResolvedValueOnce(sampleHousehold)
    vi.stubGlobal('fetch', vi.fn(() => deferredResponse.promise))

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(`user:${sampleUser.email}`)).toBeInTheDocument()
    })

    const pending = expect(
      apiFetch('/api/v1/households/hh/accounts'),
    ).rejects.toMatchObject({ status: 401 })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    await waitFor(() => {
      expect(screen.getByText(`user:${sampleAdmin.email}`)).toBeInTheDocument()
    })
    expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    expect(screen.getByText(`household:${sampleHousehold.name}`)).toBeInTheDocument()

    await act(async () => {
      deferredResponse.resolve(
        jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
      )
    })
    await pending

    expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    expect(screen.getByText(`user:${sampleAdmin.email}`)).toBeInTheDocument()
    expect(screen.getByText(`household:${sampleHousehold.name}`)).toBeInTheDocument()

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ detail: 'Unauthorized' }, { status: 401 }),
    )
    await expect(apiFetch('/api/v1/auth/me')).rejects.toMatchObject({
      status: 401,
    })
    await waitFor(() => {
      expect(screen.getByText('status:anonymous')).toBeInTheDocument()
    })
    expect(screen.getByText('user:none')).toBeInTheDocument()
    expect(screen.getByText('household:none')).toBeInTheDocument()
  })
})
