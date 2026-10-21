import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

import type { AuthContextValue } from '@/auth/auth-context'
import { AccountsPage } from '@/pages/AccountsPage'
import { ApiError } from '@/api/errors'
import {
  sampleAccounts,
  sampleAdjustment,
  sampleAdmin,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listAccountsMock = vi.fn()
const createAccountMock = vi.fn()
const getAccountMock = vi.fn()
const listAdjustmentsMock = vi.fn()
const getAdjustmentMock = vi.fn()
const reconcileAccountMock = vi.fn()
const voidAdjustmentMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/api/accounts', async () => {
  const actual = await vi.importActual<typeof import('@/api/accounts')>(
    '@/api/accounts',
  )
  return {
    ...actual,
    listAccounts: (...args: unknown[]) => listAccountsMock(...args),
    createAccount: (...args: unknown[]) => createAccountMock(...args),
    getAccount: (...args: unknown[]) => getAccountMock(...args),
  }
})

vi.mock('@/api/adjustments', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/adjustments')>(
      '@/api/adjustments',
    )
  return {
    ...actual,
    listAdjustments: (...args: unknown[]) => listAdjustmentsMock(...args),
    getAdjustment: (...args: unknown[]) => getAdjustmentMock(...args),
    reconcileAccount: (...args: unknown[]) => reconcileAccountMock(...args),
    voidAdjustment: (...args: unknown[]) => voidAdjustmentMock(...args),
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

const archivedAccount = {
  ...sampleAccounts[1]!,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Old cash',
  status: 'ARCHIVED' as const,
  currentBalance: '20',
  negativeBalanceWarning: false,
}

function cashRow() {
  return screen.getByText('1,250 MMK').closest('tr')
}

function walletRow() {
  return screen.getByText('-50 MMK').closest('tr')
}

describe('AccountsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listAccountsMock.mockReset()
    createAccountMock.mockReset()
    getAccountMock.mockReset()
    listAdjustmentsMock.mockReset()
    getAdjustmentMock.mockReset()
    reconcileAccountMock.mockReset()
    voidAdjustmentMock.mockReset()
    vi.mocked(toast.success).mockReset()
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
    expect(screen.queryByRole('button', { name: 'Adjust balance' })).toBeNull()
    expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
    expect(listAdjustmentsMock).not.toHaveBeenCalled()
    expect(getAccountMock).not.toHaveBeenCalled()
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

  it('shows adjust only for admins on active accounts, not archived', async () => {
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue([...sampleAccounts, archivedAccount])

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('1,250 MMK')).toBeInTheDocument()
    const cash = cashRow()
    expect(cash).not.toBeNull()
    expect(
      within(cash!).getByRole('button', { name: 'Adjust balance' }),
    ).toBeInTheDocument()

    const archived = screen.getByText('Old cash').closest('tr')
    expect(archived).not.toBeNull()
    expect(
      within(archived!).queryByRole('button', { name: 'Adjust balance' }),
    ).toBeNull()
    expect(listAdjustmentsMock).not.toHaveBeenCalled()
  })

  it('validates signed money, rejects fractions and a zero delta', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock.mockResolvedValue(sampleAccounts[0])
    listAdjustmentsMock.mockResolvedValue([])

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))

    const actual = await screen.findByLabelText(/Actual balance/)
    await user.type(actual, '12.5')
    await user.type(screen.getByLabelText('Reason'), 'Count')
    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))

    expect(
      await screen.findByText(
        'Actual balance must be a whole number (zero and negatives allowed).',
      ),
    ).toBeInTheDocument()
    expect(reconcileAccountMock).not.toHaveBeenCalled()

    await user.clear(actual)
    await user.type(actual, '1250')
    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))

    expect(
      await screen.findByText(
        'Actual balance matches the current balance — nothing to adjust.',
      ),
    ).toBeInTheDocument()
    expect(reconcileAccountMock).not.toHaveBeenCalled()
  })

  it('submits the fresh account balance version and refreshes history', async () => {
    const user = userEvent.setup()
    const freshCash = {
      ...sampleAccounts[0]!,
      currentBalance: '1300',
      balanceVersion: 9,
    }
    const posted = {
      ...sampleAdjustment,
      amount: '-100',
      balanceBefore: '1300',
      observedBalance: '1200',
      observedBalanceVersion: 9,
    }
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock
      .mockResolvedValueOnce(sampleAccounts)
      .mockResolvedValueOnce([
        { ...freshCash, currentBalance: '1200', balanceVersion: 10 },
        sampleAccounts[1],
      ])
    getAccountMock
      .mockResolvedValueOnce(freshCash)
      .mockResolvedValueOnce({
        ...freshCash,
        currentBalance: '1200',
        balanceVersion: 10,
      })
    listAdjustmentsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([posted])
    reconcileAccountMock.mockResolvedValue(posted)

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))

    expect(await screen.findByText('1,300 MMK')).toBeInTheDocument()
    const actual = screen.getByLabelText(/Actual balance/)
    await user.type(actual, '1200')
    expect(screen.getByText('-100 MMK')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Reason'), 'Counted cash drawer')
    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))

    await waitFor(() => {
      expect(reconcileAccountMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleAccounts[0]!.id,
        {
          actualBalance: '1200',
          expectedBalanceVersion: 9,
          reason: 'Counted cash drawer',
        },
      )
    })
    expect(await screen.findByText('Counted cash drawer')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps the submitted version on BALANCE_CHANGED until an explicit refresh', async () => {
    const user = userEvent.setup()
    const freshCash = {
      ...sampleAccounts[0]!,
      currentBalance: '1250',
      balanceVersion: 4,
    }
    const laterCash = {
      ...freshCash,
      currentBalance: '1100',
      balanceVersion: 6,
    }
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock
      .mockResolvedValueOnce(freshCash)
      .mockResolvedValueOnce(laterCash)
    listAdjustmentsMock.mockResolvedValue([])
    reconcileAccountMock
      .mockRejectedValueOnce(new ApiError(409, 'BALANCE_CHANGED'))
      .mockResolvedValueOnce({
        ...sampleAdjustment,
        amount: '100',
        balanceBefore: '1100',
        observedBalance: '1200',
        observedBalanceVersion: 6,
      })

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))

    const actual = await screen.findByLabelText(/Actual balance/)
    await user.type(actual, '1200')
    await user.type(screen.getByLabelText('Reason'), 'Till count')
    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))

    expect(
      await screen.findByText(
        'The balance changed since this form was opened. Refresh and review before submitting again.',
      ),
    ).toBeInTheDocument()
    expect(reconcileAccountMock).toHaveBeenCalledWith(
      sampleHousehold.id,
      sampleAccounts[0]!.id,
      {
        actualBalance: '1200',
        expectedBalanceVersion: 4,
        reason: 'Till count',
      },
    )

    await user.click(screen.getByRole('button', { name: 'Refresh balance' }))
    expect(await screen.findByText('1,100 MMK')).toBeInTheDocument()
    expect(screen.getByLabelText(/Actual balance/)).toHaveValue('1200')
    expect(screen.getByLabelText('Reason')).toHaveValue('Till count')

    listAccountsMock.mockResolvedValue([
      { ...laterCash, currentBalance: '1200', balanceVersion: 7 },
      sampleAccounts[1],
    ])
    getAccountMock.mockResolvedValue({
      ...laterCash,
      currentBalance: '1200',
      balanceVersion: 7,
    })
    listAdjustmentsMock.mockResolvedValue([sampleAdjustment])

    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))
    await waitFor(() => {
      expect(reconcileAccountMock).toHaveBeenLastCalledWith(
        sampleHousehold.id,
        sampleAccounts[0]!.id,
        {
          actualBalance: '1200',
          expectedBalanceVersion: 6,
          reason: 'Till count',
        },
      )
    })
  })

  it('does not claim success when reload after a posted adjustment fails', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock
      .mockResolvedValueOnce(sampleAccounts[0])
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
    listAdjustmentsMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
    reconcileAccountMock.mockResolvedValue(sampleAdjustment)

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))

    await screen.findByLabelText(/Actual balance/)
    await user.type(screen.getByLabelText(/Actual balance/), '1200')
    await user.type(screen.getByLabelText('Reason'), 'Counted cash drawer')
    await user.click(screen.getByRole('button', { name: 'Post adjustment' }))

    expect(
      await screen.findByText(
        'The change was saved, but the latest balances could not be loaded.',
      ),
    ).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Post adjustment' }),
    ).toBeDisabled()
  })

  it('ignores a stale snapshot from a previously selected account', async () => {
    const user = userEvent.setup()
    let resolveCash!: (value: typeof sampleAccounts[0]) => void
    const cashPromise = new Promise<typeof sampleAccounts[0]>((resolve) => {
      resolveCash = resolve
    })
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock.mockImplementation((_: string, accountId: string) => {
      if (accountId === sampleAccounts[0]!.id) {
        return cashPromise
      }
      return Promise.resolve(sampleAccounts[1]!)
    })
    listAdjustmentsMock.mockResolvedValue([])

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    await user.click(
      within(walletRow()!).getByRole('button', {
        name: 'Adjust balance',
      }),
    )

    const sheet = await screen.findByRole('dialog')
    expect(await within(sheet).findByText('Wallet')).toBeInTheDocument()
    expect(within(sheet).getByText('-50 MMK')).toBeInTheDocument()
    resolveCash(sampleAccounts[0]!)
    await waitFor(() => {
      expect(within(sheet).queryByText('1,250 MMK')).toBeNull()
    })
    expect(within(sheet).getByText('Wallet')).toBeInTheDocument()
    expect(within(sheet).getByText('-50 MMK')).toBeInTheDocument()
  })

  it('voids a posted adjustment and reloads balance plus history', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock
      .mockResolvedValueOnce(sampleAccounts)
      .mockResolvedValueOnce([
        { ...sampleAccounts[0]!, currentBalance: '1250', balanceVersion: 5 },
        sampleAccounts[1],
      ])
    getAccountMock
      .mockResolvedValueOnce({
        ...sampleAccounts[0]!,
        currentBalance: '1200',
        balanceVersion: 4,
      })
      .mockResolvedValueOnce({
        ...sampleAccounts[0]!,
        currentBalance: '1250',
        balanceVersion: 5,
      })
    listAdjustmentsMock
      .mockResolvedValueOnce([sampleAdjustment])
      .mockResolvedValueOnce([])
    getAdjustmentMock.mockResolvedValue(sampleAdjustment)
    voidAdjustmentMock.mockResolvedValue({
      ...sampleAdjustment,
      state: 'VOID',
      capabilities: { canVoid: false },
      version: 1,
    })

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(within(cashRow()!).getByRole('button', { name: 'Adjust balance' }))

    expect(await screen.findByText('Counted cash drawer')).toBeInTheDocument()
    await user.click(screen.getByText('Counted cash drawer'))
    const voidReason = await screen.findByLabelText('Void reason')
    await user.type(voidReason, 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void adjustment' }))

    await waitFor(() => {
      expect(voidAdjustmentMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleAdjustment.id,
        0,
        { reason: 'Entered twice' },
      )
    })
    expect(
      await screen.findByText('No posted adjustments for this account.'),
    ).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
  })

  it('ignores a delayed adjustment detail from a previously selected account', async () => {
    const user = userEvent.setup()
    const walletAdjustment = {
      ...sampleAdjustment,
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      reason: 'Wallet count',
      amount: '25',
      balanceBefore: '-50',
      observedBalance: '-25',
      account: {
        id: sampleAccounts[1]!.id,
        name: sampleAccounts[1]!.name,
      },
    }
    let resolveCashDetail!: (value: typeof sampleAdjustment) => void
    const cashDetailPromise = new Promise<typeof sampleAdjustment>(
      (resolve) => {
        resolveCashDetail = resolve
      },
    )
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock.mockImplementation((_: string, accountId: string) => {
      if (accountId === sampleAccounts[0]!.id) {
        return Promise.resolve(sampleAccounts[0]!)
      }
      return Promise.resolve(sampleAccounts[1]!)
    })
    listAdjustmentsMock.mockResolvedValue([sampleAdjustment, walletAdjustment])
    getAdjustmentMock.mockImplementation((_: string, adjustmentId: string) => {
      if (adjustmentId === sampleAdjustment.id) {
        return cashDetailPromise
      }
      return Promise.resolve(walletAdjustment)
    })

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(
      within(cashRow()!).getByRole('button', { name: 'Adjust balance' }),
    )

    expect(await screen.findByText('Counted cash drawer')).toBeInTheDocument()
    await user.click(screen.getByText('Counted cash drawer'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    await user.click(
      within(walletRow()!).getByRole('button', { name: 'Adjust balance' }),
    )
    const sheet = await screen.findByRole('dialog')
    expect(await within(sheet).findByText('Wallet count')).toBeInTheDocument()
    expect(within(sheet).queryByText('Counted cash drawer')).toBeNull()

    await act(async () => {
      resolveCashDetail(sampleAdjustment)
      await cashDetailPromise
    })
    expect(
      within(sheet).queryByRole('button', { name: 'Void adjustment' }),
    ).toBeNull()
    expect(within(sheet).queryByText('Counted cash drawer')).toBeNull()
    expect(within(sheet).getByText('Wallet count')).toBeInTheDocument()
  })

  it('freezes the sheet during reload retry and keeps void locked until reload succeeds', async () => {
    const user = userEvent.setup()
    let resolveRetry!: (value: unknown) => void
    const retryGate = new Promise((resolve) => {
      resolveRetry = resolve
    })
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock
      .mockResolvedValueOnce(sampleAccounts)
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
    getAccountMock
      .mockResolvedValueOnce({
        ...sampleAccounts[0]!,
        currentBalance: '1200',
        balanceVersion: 4,
      })
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
    listAdjustmentsMock
      .mockResolvedValueOnce([sampleAdjustment])
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
    getAdjustmentMock.mockResolvedValue(sampleAdjustment)
    voidAdjustmentMock.mockResolvedValue({
      ...sampleAdjustment,
      state: 'VOID',
      capabilities: { canVoid: false },
      version: 1,
    })

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(
      within(cashRow()!).getByRole('button', { name: 'Adjust balance' }),
    )

    expect(await screen.findByText('Counted cash drawer')).toBeInTheDocument()
    await user.click(screen.getByText('Counted cash drawer'))
    const voidReason = await screen.findByLabelText('Void reason')
    await user.type(voidReason, 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void adjustment' }))

    expect(
      await screen.findByText(
        'The change was saved, but the latest balances could not be loaded.',
      ),
    ).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Void adjustment' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Post adjustment' }),
    ).toBeDisabled()

    const retriedCash = {
      ...sampleAccounts[0]!,
      currentBalance: '1250',
      balanceVersion: 5,
    }
    listAccountsMock.mockImplementation(() =>
      retryGate.then(() => [retriedCash, sampleAccounts[1]]),
    )
    getAccountMock.mockImplementation(() => retryGate.then(() => retriedCash))
    listAdjustmentsMock.mockImplementation(() => retryGate.then(() => []))

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Post adjustment' }),
    ).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    resolveRetry(undefined)
    expect(
      await screen.findByText('No posted adjustments for this account.'),
    ).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Void adjustment' }),
    ).toBeNull()
  })

  it('does not restore canVoid from a stale detail after void', async () => {
    const user = userEvent.setup()
    let resolveStaleDetail!: (value: typeof sampleAdjustment) => void
    const staleDetail = new Promise<typeof sampleAdjustment>((resolve) => {
      resolveStaleDetail = resolve
    })
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock
      .mockResolvedValueOnce(sampleAccounts)
      .mockResolvedValueOnce([
        { ...sampleAccounts[0]!, currentBalance: '1250', balanceVersion: 5 },
        sampleAccounts[1],
      ])
    getAccountMock
      .mockResolvedValueOnce({
        ...sampleAccounts[0]!,
        currentBalance: '1200',
        balanceVersion: 4,
      })
      .mockResolvedValueOnce({
        ...sampleAccounts[0]!,
        currentBalance: '1250',
        balanceVersion: 5,
      })
    listAdjustmentsMock
      .mockResolvedValueOnce([sampleAdjustment])
      .mockResolvedValueOnce([])
    getAdjustmentMock
      .mockImplementationOnce(() => staleDetail)
      .mockResolvedValueOnce(sampleAdjustment)
    voidAdjustmentMock.mockResolvedValue({
      ...sampleAdjustment,
      state: 'VOID',
      capabilities: { canVoid: false },
      version: 1,
    })

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(
      within(cashRow()!).getByRole('button', { name: 'Adjust balance' }),
    )

    expect(await screen.findByText('Counted cash drawer')).toBeInTheDocument()
    await user.click(screen.getByText('Counted cash drawer'))
    await user.click(screen.getByText('Counted cash drawer'))
    const voidReason = await screen.findByLabelText('Void reason')
    await user.type(voidReason, 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void adjustment' }))

    expect(
      await screen.findByText('No posted adjustments for this account.'),
    ).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()

    await act(async () => {
      resolveStaleDetail({
        ...sampleAdjustment,
        capabilities: { canVoid: true },
      })
      await staleDetail
    })
    expect(
      screen.queryByRole('button', { name: 'Void adjustment' }),
    ).toBeNull()
  })

  it('accepts zero and negative actual balances and rejects out-of-range amounts', async () => {
    const user = userEvent.setup()
    const postedZero = {
      ...sampleAdjustment,
      amount: '-1250',
      balanceBefore: '1250',
      observedBalance: '0',
      reason: 'Drew down to zero',
    }
    const postedNegative = {
      ...sampleAdjustment,
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      amount: '-50',
      balanceBefore: '0',
      observedBalance: '-50',
      reason: 'Overspent drawer',
    }
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listAccountsMock.mockResolvedValue(sampleAccounts)
    getAccountMock.mockResolvedValue(sampleAccounts[0])
    listAdjustmentsMock.mockResolvedValue([])
    reconcileAccountMock.mockResolvedValue(postedZero)

    renderWithProviders(<AccountsPage />)
    await screen.findByText('1,250 MMK')
    await user.click(
      within(cashRow()!).getByRole('button', { name: 'Adjust balance' }),
    )

    const sheet = await screen.findByRole('dialog')
    const actual = await within(sheet).findByLabelText(/Actual balance/)
    await user.type(actual, '100000000000000000')
    await user.type(within(sheet).getByLabelText('Reason'), 'Too large')
    await user.click(
      within(sheet).getByRole('button', { name: 'Post adjustment' }),
    )
    expect(
      await within(sheet).findByText(
        'That amount is outside the allowed range.',
      ),
    ).toBeInTheDocument()
    expect(reconcileAccountMock).not.toHaveBeenCalled()

    await user.clear(actual)
    await user.type(actual, '0')
    expect(within(sheet).getByText('-1,250 MMK')).toBeInTheDocument()
    await user.clear(within(sheet).getByLabelText('Reason'))
    await user.type(within(sheet).getByLabelText('Reason'), 'Drew down to zero')

    listAccountsMock.mockResolvedValue([
      { ...sampleAccounts[0]!, currentBalance: '0', balanceVersion: 3 },
      sampleAccounts[1],
    ])
    getAccountMock.mockResolvedValue({
      ...sampleAccounts[0]!,
      currentBalance: '0',
      balanceVersion: 3,
    })
    listAdjustmentsMock.mockResolvedValue([postedZero])

    await user.click(
      within(sheet).getByRole('button', { name: 'Post adjustment' }),
    )
    await waitFor(() => {
      expect(reconcileAccountMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleAccounts[0]!.id,
        {
          actualBalance: '0',
          expectedBalanceVersion: 2,
          reason: 'Drew down to zero',
        },
      )
    })

    const actualAfter = await within(sheet).findByLabelText(/Actual balance/)
    await user.type(actualAfter, '-50')
    expect(within(sheet).getByText('-50 MMK')).toBeInTheDocument()
    await user.type(
      within(sheet).getByLabelText('Reason'),
      'Overspent drawer',
    )

    listAccountsMock.mockResolvedValue([
      {
        ...sampleAccounts[0]!,
        currentBalance: '-50',
        balanceVersion: 4,
        negativeBalanceWarning: true,
      },
      sampleAccounts[1],
    ])
    getAccountMock.mockResolvedValue({
      ...sampleAccounts[0]!,
      currentBalance: '-50',
      balanceVersion: 4,
      negativeBalanceWarning: true,
    })
    listAdjustmentsMock.mockResolvedValue([postedZero, postedNegative])
    reconcileAccountMock.mockResolvedValue(postedNegative)

    await user.click(
      within(sheet).getByRole('button', { name: 'Post adjustment' }),
    )
    await waitFor(() => {
      expect(reconcileAccountMock).toHaveBeenLastCalledWith(
        sampleHousehold.id,
        sampleAccounts[0]!.id,
        {
          actualBalance: '-50',
          expectedBalanceVersion: 3,
          reason: 'Overspent drawer',
        },
      )
    })
  })
})
