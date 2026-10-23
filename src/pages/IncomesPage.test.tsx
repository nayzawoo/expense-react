import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

import type { AuthContextValue } from '@/auth/auth-context'
import type { Beneficiary } from '@/api/beneficiaries'
import { ApiError } from '@/api/errors'
import type { Income } from '@/api/incomes'
import { IncomesPage } from '@/pages/IncomesPage'
import {
  sampleAccounts,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { householdToday } from '@/lib/household-date'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listIncomesMock = vi.fn()
const getIncomeMock = vi.fn()
const createIncomeMock = vi.fn()
const voidIncomeMock = vi.fn()
const listAccountsMock = vi.fn()
const listBeneficiariesMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/api/incomes', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/incomes')>('@/api/incomes')
  return {
    ...actual,
    listIncomes: (...args: unknown[]) => listIncomesMock(...args),
    getIncome: (...args: unknown[]) => getIncomeMock(...args),
    createIncome: (...args: unknown[]) => createIncomeMock(...args),
    voidIncome: (...args: unknown[]) => voidIncomeMock(...args),
  }
})

vi.mock('@/api/accounts', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/accounts')>('@/api/accounts')
  return {
    ...actual,
    listAccounts: (...args: unknown[]) => listAccountsMock(...args),
  }
})

vi.mock('@/api/beneficiaries', async () => {
  const actual = await vi.importActual<typeof import('@/api/beneficiaries')>(
    '@/api/beneficiaries',
  )
  return {
    ...actual,
    listBeneficiaries: (...args: unknown[]) => listBeneficiariesMock(...args),
  }
})

const beneficiaries: Beneficiary[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  },
]

const sampleIncomes: Income[] = [
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    kind: 'INCOME',
    state: 'POSTED',
    effectiveDate: '2026-10-15',
    amount: '400',
    currency: 'MMK',
    note: 'Salary',
    account: {
      id: sampleAccounts[0]!.id,
      name: sampleAccounts[0]!.name,
      kind: null,
    },
    beneficiary: {
      id: beneficiaries[0]!.id,
      name: beneficiaries[0]!.name,
      kind: 'HOUSEHOLD',
    },
    createdBy: {
      userId: sampleUser.id,
      displayName: sampleUser.displayName,
    },
    recordedAt: '2026-10-15T02:00:00Z',
    version: 0,
    revisionNo: 1,
    capabilities: { canVoid: true },
  },
]

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

describe('IncomesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listIncomesMock.mockReset()
    getIncomeMock.mockReset()
    createIncomeMock.mockReset()
    voidIncomeMock.mockReset()
    listAccountsMock.mockReset()
    listBeneficiariesMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it('renders posted incomes from the API', async () => {
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock.mockResolvedValue(sampleIncomes)
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)

    renderWithProviders(<IncomesPage />)

    expect(await screen.findByText('Salary')).toBeInTheDocument()
    expect(screen.getAllByText('Cash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Family Pool').length).toBeGreaterThan(0)
    expect(listIncomesMock).toHaveBeenCalledWith(sampleHousehold.id)
    expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
    expect(listBeneficiariesMock).toHaveBeenCalledWith(
      sampleHousehold.id,
      'ACTIVE',
    )
  })

  it('lets members create income against active refs', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock
      .mockResolvedValueOnce(sampleIncomes)
      .mockResolvedValueOnce([
        ...sampleIncomes,
        {
          ...sampleIncomes[0]!,
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          amount: '250',
          note: 'Bonus',
          effectiveDate: householdToday(sampleHousehold.timezone),
        },
      ])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)
    createIncomeMock.mockResolvedValue({
      ...sampleIncomes[0]!,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      amount: '250',
      note: 'Bonus',
    })

    renderWithProviders(<IncomesPage />)

    await screen.findByText('Salary')
    await user.click(screen.getByRole('button', { name: 'Add income' }))

    const dialog = await screen.findByRole('dialog', { name: 'Add income' })
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()
    expect(within(dialog).getByLabelText('Date')).toHaveValue(
      householdToday(sampleHousehold.timezone),
    )

    const amount = await screen.findByLabelText(/Amount/)
    await user.clear(amount)
    await user.type(amount, '250')
    const note = screen.getByLabelText('Note')
    await user.clear(note)
    await user.type(note, 'Bonus')
    await user.click(screen.getByRole('button', { name: 'Save income' }))

    await waitFor(() => {
      expect(createIncomeMock).toHaveBeenCalledWith(sampleHousehold.id, {
        effectiveDate: householdToday(sampleHousehold.timezone),
        amount: '250',
        accountId: sampleAccounts[0]!.id,
        beneficiaryId: beneficiaries[0]!.id,
        note: 'Bonus',
      })
    })
    expect(await screen.findByText('Bonus')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
  })

  it('omits archived accounts from the create form', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock.mockResolvedValue([])
    listAccountsMock.mockResolvedValue([
      sampleAccounts[0],
      { ...sampleAccounts[1]!, status: 'ARCHIVED' },
    ])
    listBeneficiariesMock.mockResolvedValue(beneficiaries)

    renderWithProviders(<IncomesPage />)

    await screen.findByText('No posted income yet.')
    await user.click(screen.getByRole('button', { name: 'Add income' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add income' })
    const account = within(dialog).getByLabelText('Account')
    expect(account).toHaveTextContent('Cash(Shared)')
    expect(account).not.toHaveTextContent('Wallet')
    await user.click(account)
    expect(
      await screen.findByRole('option', { name: 'Cash(Shared)' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Wallet(Shared)' })).toBeNull()
  })

  it('voids with the fresh detail version and keeps that version on retry', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock
      .mockResolvedValueOnce(sampleIncomes)
      .mockResolvedValueOnce([])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)
    getIncomeMock
      .mockResolvedValueOnce({
        ...sampleIncomes[0]!,
        version: 2,
      })
      .mockResolvedValueOnce({
        ...sampleIncomes[0]!,
        version: 4,
      })
    voidIncomeMock
      .mockRejectedValueOnce(new ApiError(500, 'Temporary failure'))
      .mockResolvedValueOnce({
        ...sampleIncomes[0]!,
        state: 'VOID',
        version: 5,
        capabilities: { canVoid: false },
      })

    renderWithProviders(<IncomesPage />)

    await screen.findByText('Salary')
    await user.click(screen.getByRole('button', { name: 'View' }))

    const detail = await screen.findByRole('dialog', { name: 'Income details' })
    expect(detail).toHaveAttribute('data-slot', 'dialog-content')
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()

    await waitFor(() => {
      expect(getIncomeMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleIncomes[0]!.id,
      )
    })

    const reason = await screen.findByLabelText('Void reason')
    await user.type(reason, 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void income' }))

    expect(
      await screen.findByText('Something went wrong with this income.'),
    ).toBeInTheDocument()
    expect(voidIncomeMock).toHaveBeenCalledWith(
      sampleHousehold.id,
      sampleIncomes[0]!.id,
      4,
      { reason: 'Entered twice' },
    )

    await user.click(screen.getByRole('button', { name: 'Void income' }))
    await waitFor(() => {
      expect(voidIncomeMock).toHaveBeenCalledTimes(2)
    })
    expect(voidIncomeMock).toHaveBeenLastCalledWith(
      sampleHousehold.id,
      sampleIncomes[0]!.id,
      4,
      { reason: 'Entered twice' },
    )
    expect(getIncomeMock).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByText('No posted income yet.'),
    ).toBeInTheDocument()
  })

  it('hides void when fresh detail says the member cannot void', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock.mockResolvedValue([
      { ...sampleIncomes[0]!, capabilities: { canVoid: false } },
    ])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)
    getIncomeMock.mockResolvedValue({
      ...sampleIncomes[0]!,
      version: 3,
      capabilities: { canVoid: false },
    })

    renderWithProviders(<IncomesPage />)

    await screen.findByText('Salary')
    await user.click(screen.getByRole('button', { name: 'View only' }))

    const dialog = await screen.findByRole('dialog', { name: 'Income details' })
    expect(await within(dialog).findByText('View only')).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Void income' }),
    ).not.toBeInTheDocument()
    expect(voidIncomeMock).not.toHaveBeenCalled()
  })

  it('shows a load error and retries the list', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock
      .mockRejectedValueOnce(new ApiError(500, 'Unavailable'))
      .mockResolvedValueOnce(sampleIncomes)
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)

    renderWithProviders(<IncomesPage />)

    expect(
      await screen.findByText('Something went wrong with this income.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Salary')).toBeInTheDocument()
  })

  it('does not treat a failed refresh as a failed write', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock
      .mockResolvedValueOnce(sampleIncomes)
      .mockRejectedValueOnce(new ApiError(500, 'Reload failed'))
      .mockResolvedValueOnce([
        ...sampleIncomes,
        {
          ...sampleIncomes[0]!,
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          amount: '250',
          note: 'Bonus',
        },
      ])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)
    createIncomeMock.mockResolvedValue({
      ...sampleIncomes[0]!,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      amount: '250',
      note: 'Bonus',
    })

    renderWithProviders(<IncomesPage />)
    await screen.findByText('Salary')
    await user.click(screen.getByRole('button', { name: 'Add income' }))

    const amount = await screen.findByLabelText(/Amount/)
    await user.type(amount, '250')
    await user.type(screen.getByLabelText('Note'), 'Bonus')
    await user.click(screen.getByRole('button', { name: 'Save income' }))

    expect(
      await screen.findByText(
        'Income was saved, but the list could not be refreshed.',
      ),
    ).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save income' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(createIncomeMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Bonus')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
    expect(createIncomeMock).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale detail from a previously selected income', async () => {
    const user = userEvent.setup()
    const other: Income = {
      ...sampleIncomes[0]!,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      note: 'Gift',
      capabilities: { canVoid: false },
    }
    let resolveFirst!: (value: Income) => void
    const firstDetail = new Promise<Income>((resolve) => {
      resolveFirst = resolve
    })
    useAuthMock.mockReturnValue(authValue())
    listIncomesMock.mockResolvedValue([...sampleIncomes, other])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    listBeneficiariesMock.mockResolvedValue(beneficiaries)
    getIncomeMock.mockImplementation((_: string, incomeId: string) => {
      if (incomeId === sampleIncomes[0]!.id) {
        return firstDetail
      }
      return Promise.resolve(other)
    })

    renderWithProviders(<IncomesPage />)
    await screen.findByText('Salary')
    await user.click(screen.getByRole('button', { name: 'View', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'View only' }))
    const dialog = await screen.findByRole('dialog', { name: 'Income details' })
    expect(await within(dialog).findByText('Gift')).toBeInTheDocument()

    await act(async () => {
      resolveFirst({
        ...sampleIncomes[0]!,
        version: 9,
        capabilities: { canVoid: true },
      })
      await firstDetail
    })

    expect(within(dialog).queryByText('Salary')).toBeNull()
    expect(
      within(dialog).queryByRole('button', { name: 'Void income' }),
    ).toBeNull()
    expect(within(dialog).getByText('Gift')).toBeInTheDocument()
  })
})
