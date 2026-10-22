import { describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'

import type { AuthContextValue } from '@/auth/auth-context'
import type { Beneficiary } from '@/api/beneficiaries'
import { ApiError } from '@/api/errors'
import { DashboardPage } from '@/pages/DashboardPage'
import {
  sampleAccounts,
  sampleCategories,
  sampleDashboard,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const fetchDashboardMock = vi.fn()
const listAccountsMock = vi.fn()
const listCategoriesMock = vi.fn()
const listBeneficiariesMock = vi.fn()
const createExpenseMock = vi.fn()
const listExpensesMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/api/dashboard', () => ({
  fetchDashboard: (...args: unknown[]) => fetchDashboardMock(...args),
}))

vi.mock('@/api/accounts', () => ({
  listAccounts: (...args: unknown[]) => listAccountsMock(...args),
}))

vi.mock('@/api/categories', () => ({
  listCategories: (...args: unknown[]) => listCategoriesMock(...args),
}))

vi.mock('@/api/beneficiaries', () => ({
  listBeneficiaries: (...args: unknown[]) => listBeneficiariesMock(...args),
}))

vi.mock('@/api/expenses', () => ({
  createExpense: (...args: unknown[]) => createExpenseMock(...args),
  listExpenses: (...args: unknown[]) => listExpensesMock(...args),
}))

const sampleBeneficiaries: Beneficiary[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  },
]

const archivedAccount = {
  ...sampleAccounts[1]!,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Old cash',
  status: 'ARCHIVED' as const,
}

const otherHousehold = {
  ...sampleHousehold,
  id: '99999999-9999-4999-8999-999999999999',
  name: 'Other Household',
}

const refreshedDashboard = {
  ...sampleDashboard,
  totalBalance: '1190',
  overview: {
    ...sampleDashboard.overview,
    expense: '360',
    net: '140',
  },
  recentActivity: [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      kind: 'EXPENSE' as const,
      effectiveDate: '2026-10-19',
      amount: '10',
      currency: 'MMK',
      note: 'Market',
      recordedAt: '2026-10-19T10:00:00Z',
      account: {
        id: sampleAccounts[0]!.id,
        name: sampleAccounts[0]!.name,
      },
      sourceAccount: null,
      destinationAccount: null,
    },
    ...sampleDashboard.recentActivity,
  ],
}

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

function PathnameProbe() {
  const { pathname } = useLocation()
  return <div data-testid="pathname">{pathname}</div>
}

function renderDashboard() {
  return renderWithProviders(
    <>
      <DashboardPage />
      <PathnameProbe />
    </>,
  )
}

function mockRefs(
  accounts = sampleAccounts,
  categories = [sampleCategories[0]],
  beneficiaries = sampleBeneficiaries,
) {
  listAccountsMock.mockResolvedValue(accounts)
  listCategoriesMock.mockResolvedValue(categories)
  listBeneficiariesMock.mockResolvedValue(beneficiaries)
}

async function openCreate(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole('button', { name: 'Add expense' }))
  return screen.findByRole('dialog', { name: 'Add expense' })
}

async function fillCreateForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { amount: string; note?: string; date?: string } = { amount: '10' },
) {
  const date = within(dialog).getByLabelText('Date')
  await user.clear(date)
  await user.type(date, values.date ?? '2026-10-19')
  await user.type(within(dialog).getByLabelText(/Amount/), values.amount)
  if (values.note) {
    await user.type(within(dialog).getByLabelText('Note'), values.note)
  }
}

describe('DashboardPage', () => {
  it('renders balances and recent activity from the dashboard API', async () => {
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('1,200 MMK')).toBeInTheDocument()
    expect(screen.getAllByText('350 MMK').length).toBeGreaterThan(0)
    expect(screen.getAllByText('500 MMK').length).toBeGreaterThan(0)
    expect(screen.getAllByText('150 MMK').length).toBeGreaterThan(0)
    expect(screen.getByText('1,250 MMK')).toBeInTheDocument()
    expect(screen.getByText('-50 MMK')).toBeInTheDocument()
    expect(screen.getByText(/Groceries/)).toBeInTheDocument()
    expect(screen.getByText('Cash → Wallet')).toBeInTheDocument()
    expect(screen.getByText(/2026-10-01 – 2026-10-19/)).toBeInTheDocument()
    expect(screen.getAllByText('Spending pace').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Spending by category').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Income and expense').length).toBeGreaterThan(0)
    expect(
      document.querySelector('[data-chart="spending-pace"] svg'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-chart="category-share"] svg'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-chart="income-expense"] svg'),
    ).toBeTruthy()
    expect(fetchDashboardMock).toHaveBeenCalledWith(sampleHousehold.id)
  })

  it('shows empty states when the snapshot has no rows', async () => {
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue({
      ...sampleDashboard,
      accounts: [],
      recentActivity: [],
      spendingPace: [],
      categoryBreakdown: [],
      beneficiarySpending: [],
    })

    renderWithProviders(<DashboardPage />)

    expect(
      await screen.findByText('No account balances to show yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No recent activity in this period.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No spending-pace points for this period.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No category spending to chart for this period.'),
    ).toBeInTheDocument()
  })

  it('shows an error and retries a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleDashboard)

    renderWithProviders(<DashboardPage />)

    expect(
      await screen.findByText('Could not load the dashboard summary.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('1,200 MMK')).toBeInTheDocument()
    })
    expect(fetchDashboardMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))

    renderWithProviders(<DashboardPage />)

    expect(
      await screen.findByText('Could not load the dashboard summary.'),
    ).toBeInTheDocument()
    expect(fetchDashboardMock).not.toHaveBeenCalled()
  })

  it('opens a centered create dialog on / and loads fresh ACTIVE refs', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)
    mockRefs(
      [...sampleAccounts, archivedAccount],
      sampleCategories,
      sampleBeneficiaries,
    )

    renderDashboard()
    await screen.findByText('1,200 MMK')
    expect(screen.getByRole('button', { name: 'Add expense' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add expense' })).toBeNull()
    expect(listAccountsMock).not.toHaveBeenCalled()
    expect(listCategoriesMock).not.toHaveBeenCalled()
    expect(listBeneficiariesMock).not.toHaveBeenCalled()
    expect(listExpensesMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')

    const dialog = await openCreate(user)
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')

    await waitFor(() => {
      expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
      expect(listCategoriesMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        'ACTIVE',
      )
      expect(listBeneficiariesMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        'ACTIVE',
      )
    })
    expect(listExpensesMock).not.toHaveBeenCalled()
    expect(await within(dialog).findByRole('option', { name: 'Cash' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('option', { name: 'Old cash' })).toBeNull()
    expect(within(dialog).queryByRole('option', { name: 'Transport' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add expense' })).toHaveFocus()
    })
  })

  it('posts through createExpense and refreshes dashboard data without leaving /', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock
      .mockResolvedValueOnce(sampleDashboard)
      .mockResolvedValueOnce(refreshedDashboard)
    mockRefs()
    createExpenseMock.mockResolvedValue({})

    renderDashboard()
    await screen.findByText('1,200 MMK')
    const dialog = await openCreate(user)
    await fillCreateForm(user, dialog, { amount: '10', note: 'Market' })
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }))

    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledWith(sampleHousehold.id, {
        effectiveDate: '2026-10-19',
        amount: '10',
        accountId: sampleAccounts[0]!.id,
        categoryId: sampleCategories[0]!.id,
        beneficiaryId: sampleBeneficiaries[0]!.id,
        note: 'Market',
      })
    })
    expect(listExpensesMock).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText('1,190 MMK')).toBeInTheDocument()
    expect(screen.getByText(/Market/)).toBeInTheDocument()
    expect(screen.getAllByText('360 MMK').length).toBeGreaterThan(0)
    expect(fetchDashboardMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
  })

  it('keeps entered fields after a failed write so the same values can retry', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)
    mockRefs()
    createExpenseMock
      .mockRejectedValueOnce(new ApiError(400, 'INVALID_MONEY'))
      .mockResolvedValueOnce({})

    renderDashboard()
    await screen.findByText('1,200 MMK')
    const dialog = await openCreate(user)
    await fillCreateForm(user, dialog, { amount: '10', note: 'Market' })
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }))

    expect(
      await within(dialog).findByText(
        'Amount must be a whole positive number with no decimals.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('10')
    expect(within(dialog).getByLabelText('Note')).toHaveValue('Market')
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')

    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }))
    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledTimes(2)
      expect(createExpenseMock).toHaveBeenLastCalledWith(sampleHousehold.id, {
        effectiveDate: '2026-10-19',
        amount: '10',
        accountId: sampleAccounts[0]!.id,
        categoryId: sampleCategories[0]!.id,
        beneficiaryId: sampleBeneficiaries[0]!.id,
        note: 'Market',
      })
    })
  })

  it('blocks dismiss while create is pending', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)
    mockRefs()
    let releaseSave: () => void = () => {}
    createExpenseMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSave = () => resolve({})
        }),
    )

    renderDashboard()
    await screen.findByText('1,200 MMK')
    const dialog = await openCreate(user)
    await fillCreateForm(user, dialog, { amount: '10' })
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }))

    expect(await within(dialog).findByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Close' })).toBeNull()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
    expect(createExpenseMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')

    releaseSave()
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows a dashboard retry error when refresh fails after a successful write', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock
      .mockResolvedValueOnce(sampleDashboard)
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
    mockRefs()
    createExpenseMock.mockResolvedValue({})

    renderDashboard()
    await screen.findByText('1,200 MMK')
    const dialog = await openCreate(user)
    await fillCreateForm(user, dialog, { amount: '10' })
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })
    expect(
      await screen.findByText('Could not load the dashboard summary.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Could not save')).toBeNull()
    expect(createExpenseMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
  })

  it('ignores stale reference responses after close/reopen and household change', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)
    listCategoriesMock.mockResolvedValue([sampleCategories[0]])
    listBeneficiariesMock.mockResolvedValue(sampleBeneficiaries)

    let resolveFirst: (value: typeof sampleAccounts) => void = () => {}
    const firstAccounts = new Promise<typeof sampleAccounts>((resolve) => {
      resolveFirst = resolve
    })
    listAccountsMock
      .mockImplementationOnce(() => firstAccounts)
      .mockResolvedValueOnce([{ ...sampleAccounts[0]!, name: 'Fresh Cash' }])

    const view = renderDashboard()
    await screen.findByText('1,200 MMK')
    await openCreate(user)
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })

    const reopened = await openCreate(user)
    expect(
      await within(reopened).findByRole('option', { name: 'Fresh Cash' }),
    ).toBeInTheDocument()

    await act(async () => {
      resolveFirst(sampleAccounts)
      await firstAccounts
    })
    expect(within(reopened).queryByRole('option', { name: 'Wallet' })).toBeNull()
    expect(
      within(reopened).getByRole('option', { name: 'Fresh Cash' }),
    ).toBeInTheDocument()

    await user.click(within(reopened).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add expense' }),
      ).not.toBeInTheDocument()
    })

    let resolveStaleHousehold: (value: typeof sampleAccounts) => void = () => {}
    const staleHouseholdAccounts = new Promise<typeof sampleAccounts>(
      (resolve) => {
        resolveStaleHousehold = resolve
      },
    )
    listAccountsMock.mockReset()
    listAccountsMock
      .mockImplementationOnce(() => staleHouseholdAccounts)
      .mockResolvedValueOnce([
        { ...sampleAccounts[0]!, id: 'acct-other', name: 'Other Cash' },
      ])
    listCategoriesMock.mockResolvedValue([sampleCategories[0]])
    listBeneficiariesMock.mockResolvedValue(sampleBeneficiaries)

    await openCreate(user)
    useAuthMock.mockReturnValue(authValue({ household: otherHousehold }))
    view.rerender(
      <>
        <DashboardPage />
        <PathnameProbe />
      </>,
    )

    expect(
      await screen.findByRole('option', { name: 'Other Cash' }),
    ).toBeInTheDocument()
    await act(async () => {
      resolveStaleHousehold(sampleAccounts)
      await staleHouseholdAccounts
    })
    expect(screen.queryByRole('option', { name: 'Wallet' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Other Cash' })).toBeInTheDocument()
    expect(listAccountsMock).toHaveBeenCalledWith(otherHousehold.id)
    expect(listExpensesMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
  })

  it('retries a failed reference load and shows an empty state', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchDashboardMock.mockResolvedValue(sampleDashboard)
    listAccountsMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce([])
    listCategoriesMock.mockResolvedValue([sampleCategories[0]])
    listBeneficiariesMock.mockResolvedValue(sampleBeneficiaries)

    renderDashboard()
    await screen.findByText('1,200 MMK')
    const dialog = await openCreate(user)
    expect(
      await within(dialog).findByText('Something went wrong with this expense.'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(
      await within(dialog).findByText('No active accounts'),
    ).toBeInTheDocument()
    expect(listAccountsMock).toHaveBeenCalledTimes(2)
    expect(listExpensesMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
  })
})
