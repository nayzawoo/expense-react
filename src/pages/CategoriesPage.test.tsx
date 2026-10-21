import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

async function chooseIcon(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /Choose icon/ }))
  const picker = await screen.findByRole('dialog', { name: 'Choose an icon' })
  await user.click(within(picker).getByRole('button', { name }))
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Choose an icon' }),
    ).not.toBeInTheDocument()
  })
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listCategoriesMock.mockReset()
    createCategoryMock.mockReset()
    updateCategoryMock.mockReset()
    updateCategoryStatusMock.mockReset()
  })

  it('renders household categories from the API for members without mutation controls', async () => {
    useAuthMock.mockReturnValue(authValue())
    listCategoriesMock.mockResolvedValue(sampleCategories)

    renderWithProviders(<CategoriesPage />)

    expect((await screen.findAllByText('Food')).length).toBe(1)
    expect(screen.getAllByText('Transport').length).toBe(1)
    expect(screen.getByText('#AABBCC')).toBeInTheDocument()
    expect(screen.getByText('Sample Household · MMK')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(listCategoriesMock).toHaveBeenCalledWith(sampleHousehold.id, 'ALL')

    const foodRow = screen.getByRole('row', { name: /Food/ })
    const icon = within(foodRow).getByRole('img', { name: 'Food' })
    expect(icon).not.toHaveTextContent('Food')
  })

  it('opens a centered modal dialog rather than a side sheet', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listCategoriesMock.mockResolvedValue(sampleCategories)

    renderWithProviders(<CategoriesPage />)

    expect((await screen.findAllByText('Food')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    const dialog = await screen.findByRole('dialog', { name: 'Add category' })
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()
    expect(
      screen.getByText(
        'Admins create expense labels with a color and icon key.',
      ),
    ).toBeInTheDocument()
  })

  it('lets admins create a category with the picked icon key', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listCategoriesMock
      .mockResolvedValueOnce(sampleCategories)
      .mockResolvedValueOnce([
        ...sampleCategories,
        {
          id: '88888888-8888-4888-8888-888888888888',
          name: 'Clinic',
          color: '#22AA66',
          iconKey: 'health',
          sortOrder: 3,
          status: 'ACTIVE',
          version: 0,
        },
      ])
    createCategoryMock.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Clinic',
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
    await user.type(nameInput, 'Clinic')

    const hexInput = screen.getByLabelText('Color hex')
    await user.clear(hexInput)
    await user.type(hexInput, '#22AA66')

    await chooseIcon(user, 'Health')
    await user.click(screen.getByRole('button', { name: 'Save category' }))

    await waitFor(() => {
      expect(createCategoryMock).toHaveBeenCalledWith(sampleHousehold.id, {
        name: 'Clinic',
        color: '#22AA66',
        iconKey: 'health',
        sortOrder: 3,
      })
    })
    expect((await screen.findAllByText('Clinic')).length).toBeGreaterThan(0)
  })

  it('lets admins edit a category while preserving then changing the icon key', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listCategoriesMock
      .mockResolvedValueOnce(sampleCategories)
      .mockResolvedValueOnce([
        {
          ...sampleCategories[0]!,
          name: 'Groceries',
          iconKey: 'shopping',
          version: 1,
        },
        sampleCategories[1],
      ])
    updateCategoryMock.mockResolvedValue({
      ...sampleCategories[0]!,
      name: 'Groceries',
      iconKey: 'shopping',
      version: 1,
    })

    renderWithProviders(<CategoriesPage />)

    const foodRow = await screen.findByRole('row', { name: /Food/ })
    await user.click(within(foodRow).getByRole('button', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit category' })
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Food')
    expect(
      within(dialog).getByRole('button', { name: /Choose icon \(Food\)/ }),
    ).toHaveAttribute('data-icon-key', 'food')

    const nameInput = within(dialog).getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Groceries')
    await chooseIcon(user, 'Shopping')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(updateCategoryMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleCategories[0]!.id,
        {
          name: 'Groceries',
          color: '#AABBCC',
          iconKey: 'shopping',
          sortOrder: 1,
        },
      )
    })
    expect((await screen.findAllByText('Groceries')).length).toBeGreaterThan(0)
  })

  it('keeps the modal open while a save is pending', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue({ user: sampleAdmin }))
    listCategoriesMock.mockResolvedValue(sampleCategories)
    let releaseSave: () => void = () => {}
    createCategoryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSave = () =>
            resolve({
              id: '88888888-8888-4888-8888-888888888888',
              name: 'Clinic',
              color: '#64748B',
              iconKey: 'other',
              sortOrder: 3,
              status: 'ACTIVE',
              version: 0,
            })
        }),
    )

    renderWithProviders(<CategoriesPage />)

    await screen.findByText('Food')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await user.type(await screen.findByLabelText('Name'), 'Clinic')
    await user.click(screen.getByRole('button', { name: 'Save category' }))

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('dialog', { name: 'Add category' }),
    ).toBeInTheDocument()
    expect(createCategoryMock).toHaveBeenCalledTimes(1)

    releaseSave()
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add category' }),
      ).not.toBeInTheDocument()
    })
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
