import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import { ApiError } from '@/api/errors'
import { CategoriesPage } from '@/pages/CategoriesPage'
import {
  sampleAdmin,
  sampleCategories,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listCategoriesMock = vi.fn()
const createCategoryMock = vi.fn()
const updateCategoryMock = vi.fn()
const updateCategoryStatusMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/categories', async () => {
  const actual = await vi.importActual<typeof import('@/api/categories')>(
    '@/api/categories',
  )
  return {
    ...actual,
    listCategories: (...args: unknown[]) => listCategoriesMock(...args),
    createCategory: (...args: unknown[]) => createCategoryMock(...args),
    updateCategory: (...args: unknown[]) => updateCategoryMock(...args),
    updateCategoryStatus: (...args: unknown[]) =>
      updateCategoryStatusMock(...args),
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

describe('CategoriesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listCategoriesMock.mockReset()
    createCategoryMock.mockReset()
    updateCategoryMock.mockReset()
    updateCategoryStatusMock.mockReset()
  })

  it('renders household categories from the API for members', async () => {
    useAuthMock.mockReturnValue(authValue())
    listCategoriesMock.mockResolvedValue(sampleCategories)

    renderWithProviders(<CategoriesPage />)

    expect((await screen.findAllByText('Food')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(0)
    expect(screen.getByText('#AABBCC')).toBeInTheDocument()
    expect(screen.getByText('Sample Household · MMK')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull()
    expect(listCategoriesMock).toHaveBeenCalledWith(sampleHousehold.id, 'ALL')
  })

  it('lets admins create a category', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listCategoriesMock
      .mockResolvedValueOnce(sampleCategories)
      .mockResolvedValueOnce([
        ...sampleCategories,
        {
          id: '88888888-8888-4888-8888-888888888888',
          name: 'Health',
          color: '#22AA66',
          iconKey: 'health',
          sortOrder: 3,
          status: 'ACTIVE',
          version: 0,
        },
      ])
    createCategoryMock.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Health',
      color: '#22AA66',
      iconKey: 'health',
      sortOrder: 3,
      status: 'ACTIVE',
      version: 0,
    })

    renderWithProviders(<CategoriesPage />)

    expect((await screen.findAllByText('Food')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Health')

    const hexInput = screen.getByLabelText('Color hex')
    await user.clear(hexInput)
    await user.type(hexInput, '#22AA66')

    await user.selectOptions(screen.getByLabelText('Icon'), 'health')
    await user.click(screen.getByRole('button', { name: 'Save category' }))

    await waitFor(() => {
      expect(createCategoryMock).toHaveBeenCalledWith(sampleHousehold.id, {
        name: 'Health',
        color: '#22AA66',
        iconKey: 'health',
        sortOrder: 3,
      })
    })
    expect((await screen.findAllByText('Health')).length).toBeGreaterThan(0)
  })

  it('shows an error and retries a failed load', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listCategoriesMock
      .mockRejectedValueOnce(new ApiError(500, 'Upstream failed'))
      .mockResolvedValueOnce(sampleCategories)

    renderWithProviders(<CategoriesPage />)

    expect(
      await screen.findByText('Could not load categories.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    })
    expect(listCategoriesMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load error when household context is missing', async () => {
    useAuthMock.mockReturnValue(authValue({ household: null }))

    renderWithProviders(<CategoriesPage />)

    expect(
      await screen.findByText('Could not load categories.'),
    ).toBeInTheDocument()
    expect(listCategoriesMock).not.toHaveBeenCalled()
  })
})
