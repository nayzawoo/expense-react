import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import { ApiError } from '@/api/errors'
import { DashboardPage } from '@/pages/DashboardPage'
import {
  sampleDashboard,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const fetchDashboardMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/dashboard', () => ({
  fetchDashboard: (...args: unknown[]) => fetchDashboardMock(...args),
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
})
