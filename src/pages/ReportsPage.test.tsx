import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import { ApiError } from '@/api/errors'
import { ReportsPage } from '@/pages/ReportsPage'
import {
  sampleAnalytics,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const fetchAnalyticsMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/reports', () => ({
  fetchAnalytics: (...args: unknown[]) => fetchAnalyticsMock(...args),
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

describe('ReportsPage', () => {
  it('renders analytics overview, trend, and category breakdown', async () => {
    useAuthMock.mockReturnValue(authValue())
    fetchAnalyticsMock.mockResolvedValue(sampleAnalytics)

    renderWithProviders(<ReportsPage />)

    expect(
      await screen.findByRole('heading', { name: 'Reports' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('800 MMK').length).toBeGreaterThan(0)
    expect(screen.getByText('1,200 MMK')).toBeInTheDocument()
    expect(screen.getAllByText('400 MMK').length).toBeGreaterThan(0)
    expect(screen.getByText(/As of 2026-10-19/)).toBeInTheDocument()
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    expect(screen.getByText('62.5%')).toBeInTheDocument()
    expect(screen.getByText('2026-10')).toBeInTheDocument()
    expect(screen.getByText(/spending is up/i)).toBeInTheDocument()
    expect(fetchAnalyticsMock).toHaveBeenCalledWith(
      sampleHousehold.id,
      undefined,
    )
  })

  it('shows empty states when analytics has no breakdown rows', async () => {
    useAuthMock.mockReturnValue(authValue())
    fetchAnalyticsMock.mockResolvedValue({
      ...sampleAnalytics,
      categoryBreakdown: [],
      categoryChanges: { increased: [], decreased: [] },
      monthlyTrend: [],
      insight: null,
    })

    renderWithProviders(<ReportsPage />)

    expect(
      await screen.findByText('No monthly trend points for this period.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No category breakdown for this period.'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('No category changes to show.').length,
    ).toBeGreaterThan(0)
  })

  it('applies an as-of date and retries after a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    fetchAnalyticsMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleAnalytics)
      .mockResolvedValueOnce(sampleAnalytics)

    renderWithProviders(<ReportsPage />)

    expect(
      await screen.findByText('Could not load period reports.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getAllByText('800 MMK').length).toBeGreaterThan(0)
    })

    const asOf = screen.getByLabelText('As of date')
    fireEvent.change(asOf, { target: { value: '2026-10-10' } })
    await user.click(screen.getByRole('button', { name: 'Apply date' }))

    await waitFor(() => {
      expect(fetchAnalyticsMock).toHaveBeenLastCalledWith(
        sampleHousehold.id,
        '2026-10-10',
      )
    })
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))
    fetchAnalyticsMock.mockResolvedValue(sampleAnalytics)

    renderWithProviders(<ReportsPage />)

    expect(
      await screen.findByText('Could not load period reports.'),
    ).toBeInTheDocument()
    expect(fetchAnalyticsMock).not.toHaveBeenCalled()
  })
})
