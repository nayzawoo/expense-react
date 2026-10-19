import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import { AccountsPage } from '@/pages/AccountsPage'
import { ApiError } from '@/api/errors'
import {
  sampleAccounts,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listAccountsMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/accounts', () => ({
  listAccounts: (...args: unknown[]) => listAccountsMock(...args),
}))

function authValue(partial: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: sampleUser,
    household: sampleHousehold,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshSession: vi.fn(),
    clearError: vi.fn(),
    ...partial,
  }
}

describe('AccountsPage', () => {
  it('renders household accounts from the API', async () => {
    useAuthMock.mockReturnValue(authValue())
    listAccountsMock.mockResolvedValue(sampleAccounts)

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('1,250 MMK')).toBeInTheDocument()
    expect(screen.getByText('-50 MMK')).toBeInTheDocument()
    expect(screen.getByText('Sample Household · MMK')).toBeInTheDocument()
    expect(screen.getAllByText('Cash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0)
    expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
  })

  it('shows the empty state when there are no accounts', async () => {
    useAuthMock.mockReturnValue(authValue())
    listAccountsMock.mockResolvedValue([])

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('No accounts yet.')).toBeInTheDocument()
  })

  it('shows an error and retries a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listAccountsMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleAccounts)

    renderWithProviders(<AccountsPage />)

    expect(
      await screen.findByText('Could not load accounts.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('1,250 MMK')).toBeInTheDocument()
    })
    expect(listAccountsMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))

    renderWithProviders(<AccountsPage />)

    expect(
      await screen.findByText('Could not load accounts.'),
    ).toBeInTheDocument()
    expect(listAccountsMock).not.toHaveBeenCalled()
  })
})
