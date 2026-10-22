import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { RequireAuth } from '@/auth/RequireAuth'
import type { AuthContextValue } from '@/auth/auth-context'
import {
  sampleAdminMustChange,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

function authValue(partial: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: 'loading',
    user: null,
    household: null,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshSession: vi.fn(),
    clearError: vi.fn(),
    ...partial,
  }
}

function renderGate(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/accounts" element={<div>Accounts page</div>} />
        <Route path="/change-password" element={<div>Password page</div>} />
      </Route>
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route: initialPath },
  )
}

describe('RequireAuth', () => {
  it('shows a loading state while the session is unresolved', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'loading' }))
    renderGate('/accounts')
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects anonymous visitors to login', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'anonymous' }))
    renderGate('/accounts')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects users who must change password', () => {
    useAuthMock.mockReturnValue(
      authValue({
        status: 'authenticated',
        user: sampleAdminMustChange,
      }),
    )
    renderGate('/accounts')
    expect(screen.getByText('Password page')).toBeInTheDocument()
  })

  it('keeps authenticated users on protected routes', () => {
    useAuthMock.mockReturnValue(
      authValue({
        status: 'authenticated',
        user: sampleUser,
      }),
    )
    renderGate('/accounts')
    expect(screen.getByText('Accounts page')).toBeInTheDocument()
  })

  it('lets ordinary members open their own password change page', () => {
    useAuthMock.mockReturnValue(
      authValue({
        status: 'authenticated',
        user: sampleUser,
      }),
    )
    renderGate('/change-password')
    expect(screen.getByText('Password page')).toBeInTheDocument()
  })
})
