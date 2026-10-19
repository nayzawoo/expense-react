import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { sampleUser } from '@/test/fixtures'

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

function LogoutProbe() {
  const { status, user, error, logout } = useAuth()
  return (
    <div>
      <p>status:{status}</p>
      <p>user:{user?.email ?? 'none'}</p>
      <p>error:{error ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          void logout().catch(() => undefined)
        }}
      >
        Sign out
      </button>
    </div>
  )
}

describe('AuthProvider logout', () => {
  beforeEach(() => {
    fetchCurrentUserMock.mockReset()
    loginMock.mockReset()
    logoutMock.mockReset()
    changePasswordMock.mockReset()
    fetchHouseholdMock.mockReset()
    fetchCurrentUserMock.mockResolvedValue(sampleUser)
    fetchHouseholdMock.mockResolvedValue(null)
  })

  it('keeps the authenticated session when logout fails', async () => {
    const user = userEvent.setup()
    logoutMock.mockRejectedValue(new Error('logout boom'))

    render(
      <AuthProvider>
        <LogoutProbe />
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
  })

  it('clears auth only after logout succeeds', async () => {
    const user = userEvent.setup()
    logoutMock.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <LogoutProbe />
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
  })
})
