import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import type { Beneficiary } from '@/api/beneficiaries'
import { ApiError } from '@/api/errors'
import { BeneficiariesPage } from '@/pages/BeneficiariesPage'
import { sampleHousehold, sampleUser } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listBeneficiariesMock = vi.fn()
const createBeneficiaryMock = vi.fn()
const updateBeneficiaryMock = vi.fn()
const updateBeneficiaryStatusMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/beneficiaries', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/beneficiaries')>(
      '@/api/beneficiaries',
    )
  return {
    ...actual,
    listBeneficiaries: (...args: unknown[]) => listBeneficiariesMock(...args),
    createBeneficiary: (...args: unknown[]) => createBeneficiaryMock(...args),
    updateBeneficiary: (...args: unknown[]) => updateBeneficiaryMock(...args),
    updateBeneficiaryStatus: (...args: unknown[]) =>
      updateBeneficiaryStatusMock(...args),
  }
})

const sampleBeneficiaries: Beneficiary[] = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    name: 'Misc Group',
    kind: 'OTHER',
    sortOrder: 1,
    status: 'ARCHIVED',
    version: 1,
  },
]

const sampleAdmin = {
  ...sampleUser,
  id: '88888888-8888-4888-8888-888888888888',
  email: 'admin@example.com',
  displayName: 'Sample Admin',
  role: 'ADMIN' as const,
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

describe('BeneficiariesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listBeneficiariesMock.mockReset()
    createBeneficiaryMock.mockReset()
    updateBeneficiaryMock.mockReset()
    updateBeneficiaryStatusMock.mockReset()
  })

  it('renders beneficiaries from the API for members without mutation controls', async () => {
    useAuthMock.mockReturnValue(authValue())
    listBeneficiariesMock.mockResolvedValue(sampleBeneficiaries)

    renderWithProviders(<BeneficiariesPage />)

    expect(await screen.findByText('Family Pool')).toBeInTheDocument()
    expect(screen.getByText('Misc Group')).toBeInTheDocument()
    expect(listBeneficiariesMock).toHaveBeenCalledWith(
      sampleHousehold.id,
      'ALL',
    )
    expect(
      screen.queryByRole('button', { name: 'Add beneficiary' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument()
  })

  it('lets admins create a beneficiary', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listBeneficiariesMock
      .mockResolvedValueOnce(sampleBeneficiaries)
      .mockResolvedValueOnce([
        ...sampleBeneficiaries,
        {
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Shared Person',
          kind: 'PERSON',
          sortOrder: 2,
          status: 'ACTIVE',
          version: 0,
        },
      ])
    createBeneficiaryMock.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Shared Person',
      kind: 'PERSON',
      sortOrder: 2,
      status: 'ACTIVE',
      version: 0,
    })

    renderWithProviders(<BeneficiariesPage />)

    await screen.findByText('Family Pool')
    await user.click(screen.getByRole('button', { name: 'Add beneficiary' }))
    await user.type(screen.getByLabelText('Name'), 'Shared Person')
    await user.click(screen.getByRole('button', { name: 'Save beneficiary' }))

    await waitFor(() => {
      expect(createBeneficiaryMock).toHaveBeenCalledWith(sampleHousehold.id, {
        name: 'Shared Person',
        kind: 'PERSON',
        sortOrder: 0,
      })
    })
    expect(await screen.findByText('Shared Person')).toBeInTheDocument()
  })

  it('shows an error and retries a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listBeneficiariesMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleBeneficiaries)

    renderWithProviders(<BeneficiariesPage />)

    expect(
      await screen.findByText('Could not load beneficiaries.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Family Pool')).toBeInTheDocument()
    })
    expect(listBeneficiariesMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))

    renderWithProviders(<BeneficiariesPage />)

    expect(
      await screen.findByText('Could not load beneficiaries.'),
    ).toBeInTheDocument()
    expect(listBeneficiariesMock).not.toHaveBeenCalled()
  })
})