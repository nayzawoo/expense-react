import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import { AccountsPage } from '@/pages/AccountsPage'
import { ApiError } from '@/api/errors'
import {
  sampleAccounts,
  sampleAdmin,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listAccountsMock = vi.fn()
const createAccountMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/accounts', async () => {
  const actual = await vi.importActual<typeof import('@/api/accounts')>(
    '@/api/accounts',
  )
  return {
    ...actual,
    listAccounts: (...args: unknown[]) => listAccountsMock(...args),
    createAccount: (...args: unknown[]) => createAccountMock(...args),
  }
})

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
  beforeEach(() => {
    useAuthMock.mockReset()
    listAccountsMock.mockReset()
    createAccountMock.mockReset()
  })

  it('renders household accounts from the API for members', async () => {
    useAuthMock.mockReturnValue(authValue())
    listAccountsMock.mockResolvedValue(sampleAccounts)

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('1,250 MMK')).toBeInTheDocument()
    expect(screen.getByText('-50 MMK')).toBeInTheDocument()
    expect(screen.getByText('Sample Household · MMK')).toBeInTheDocument()
    expect(screen.getAllByText('Cash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
  })

  it('lets admins create an account', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock
      .mockResolvedValueOnce(sampleAccounts)
      .mockResolvedValueOnce([
        ...sampleAccounts,
        {
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Savings',
          type: 'BANK',
          ownerLabel: 'Shared',
          openedOn: '2026-03-01',
          openingAmount: '500',
          currentBalance: '500',
          balanceAsOf: '2026-10-19',
          balanceVersion: 1,
          negativeBalanceWarning: false,
          status: 'ACTIVE',
          sortOrder: 3,
          version: 0,
          currency: 'MMK',
        },
      ])
    createAccountMock.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Savings',
      type: 'BANK',
      ownerLabel: 'Shared',
      openedOn: '2026-03-01',
      openingAmount: '500',
      currentBalance: '500',
      balanceAsOf: '2026-10-19',
      balanceVersion: 1,
      negativeBalanceWarning: false,
      status: 'ACTIVE',
      sortOrder: 3,
      version: 0,
      currency: 'MMK',
    })

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('1,250 MMK')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add account' }))

    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Savings')

    await user.selectOptions(screen.getByLabelText('Type'), 'BANK')

    const ownerInput = screen.getByLabelText('Owner')
    await user.clear(ownerInput)
    await user.type(ownerInput, 'Shared')

    const openedOn = screen.getByLabelText('Opened on')
    await user.clear(openedOn)
    await user.type(openedOn, '2026-03-01')

    const openingAmount = screen.getByLabelText('Opening amount (MMK)')
    await user.clear(openingAmount)
    await user.type(openingAmount, '500')

    await user.click(screen.getByRole('button', { name: 'Save account' }))

    await waitFor(() => {
      expect(createAccountMock).toHaveBeenCalledWith(sampleHousehold.id, {
        name: 'Savings',
        type: 'BANK',
        ownerLabel: 'Shared',
        openedOn: '2026-03-01',
        openingAmount: '500',
        sortOrder: 3,
      })
    })
    expect((await screen.findAllByText('Savings')).length).toBeGreaterThan(0)
  })

  it('filters archived accounts client-side without a status query', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listAccountsMock.mockResolvedValue([
      sampleAccounts[0],
      { ...sampleAccounts[1], status: 'ARCHIVED' },
    ])

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('1,250 MMK')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'ARCHIVED')
    expect(await screen.findByText('-50 MMK')).toBeInTheDocument()
    expect(screen.queryByText('1,250 MMK')).toBeNull()
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
