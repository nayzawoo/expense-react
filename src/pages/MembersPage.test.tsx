import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import type { HouseholdUser } from '@/api/users'
import { ApiError } from '@/api/errors'
import { MembersPage } from '@/pages/MembersPage'
import { sampleAdmin, sampleHousehold, sampleUser } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listHouseholdUsersMock = vi.fn()
const createHouseholdUserMock = vi.fn()
const updateHouseholdUserMock = vi.fn()
const assignTemporaryPasswordMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/api/users')>('@/api/users')
  return {
    ...actual,
    listHouseholdUsers: (...args: unknown[]) => listHouseholdUsersMock(...args),
    createHouseholdUser: (...args: unknown[]) => createHouseholdUserMock(...args),
    updateHouseholdUser: (...args: unknown[]) => updateHouseholdUserMock(...args),
    assignTemporaryPassword: (...args: unknown[]) =>
      assignTemporaryPasswordMock(...args),
  }
})

const sampleMembers: HouseholdUser[] = [
  {
    id: sampleAdmin.id,
    email: sampleAdmin.email,
    displayName: sampleAdmin.displayName,
    role: 'ADMIN',
    status: 'ACTIVE',
    mustChangePassword: false,
    passwordChangeCompleted: true,
  },
  {
    id: sampleUser.id,
    email: sampleUser.email,
    displayName: sampleUser.displayName,
    role: 'MEMBER',
    status: 'ACTIVE',
    mustChangePassword: true,
    passwordChangeCompleted: false,
  },
]

function authValue(partial: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: sampleAdmin,
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

describe('MembersPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listHouseholdUsersMock.mockReset()
    createHouseholdUserMock.mockReset()
    updateHouseholdUserMock.mockReset()
    assignTemporaryPasswordMock.mockReset()
  })

  it('shows an admin-only message for members without calling the API', async () => {
    useAuthMock.mockReturnValue(authValue({ user: sampleUser }))

    renderWithProviders(<MembersPage />)

    expect(
      await screen.findByText('Only household admins can manage members.'),
    ).toBeInTheDocument()
    expect(listHouseholdUsersMock).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Add member' }),
    ).not.toBeInTheDocument()
  })

  it('renders household members for admins', async () => {
    useAuthMock.mockReturnValue(authValue())
    listHouseholdUsersMock.mockResolvedValue(sampleMembers)

    renderWithProviders(<MembersPage />)

    expect(await screen.findByText('Sample Admin')).toBeInTheDocument()
    expect(screen.getByText('Sample Member')).toBeInTheDocument()
    expect(screen.getByText('Must change')).toBeInTheDocument()
    expect(listHouseholdUsersMock).toHaveBeenCalledWith(sampleHousehold.id)
  })

  it('lets admins provision a new member', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listHouseholdUsersMock
      .mockResolvedValueOnce(sampleMembers)
      .mockResolvedValueOnce([
        ...sampleMembers,
        {
          id: '99999999-9999-4999-8999-999999999999',
          email: 'new.member@example.com',
          displayName: 'New Member',
          role: 'MEMBER',
          status: 'ACTIVE',
          mustChangePassword: true,
          passwordChangeCompleted: false,
        },
      ])
    createHouseholdUserMock.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      email: 'new.member@example.com',
      displayName: 'New Member',
      role: 'MEMBER',
      status: 'ACTIVE',
      mustChangePassword: true,
      passwordChangeCompleted: false,
    })

    renderWithProviders(<MembersPage />)

    await screen.findByText('Sample Admin')
    await user.click(screen.getByRole('button', { name: 'Add member' }))
    await user.type(screen.getByLabelText('Display name'), 'New Member')
    await user.type(screen.getByLabelText('Email'), 'new.member@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'temp-pass-1')
    await user.click(screen.getByRole('button', { name: 'Save member' }))

    await waitFor(() => {
      expect(createHouseholdUserMock).toHaveBeenCalledWith(sampleHousehold.id, {
        displayName: 'New Member',
        email: 'new.member@example.com',
        temporaryPassword: 'temp-pass-1',
        role: 'MEMBER',
      })
    })
    expect(await screen.findByText('New Member')).toBeInTheDocument()
  })

  it('shows an error and retries a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listHouseholdUsersMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleMembers)

    renderWithProviders(<MembersPage />)

    expect(
      await screen.findByText('Could not load household members.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Sample Admin')).toBeInTheDocument()
    })
    expect(listHouseholdUsersMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))

    renderWithProviders(<MembersPage />)

    expect(
      await screen.findByText('Could not load household members.'),
    ).toBeInTheDocument()
    expect(listHouseholdUsersMock).not.toHaveBeenCalled()
  })
})
