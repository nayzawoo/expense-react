import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CATEGORY_ICON_KEYS } from '@/api/categories'
import { CategoryForm } from '@/components/categories/CategoryForm'
import { iconKeyAriaLabel } from '@/lib/category-icons'
import { sampleCategories } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const VISIBLE_ICON_NAMES = CATEGORY_ICON_KEYS.map(iconKeyAriaLabel)
const LAST_ICON_KEY = CATEGORY_ICON_KEYS.at(-1)!
const LAST_ICON_LABEL = iconKeyAriaLabel(LAST_ICON_KEY)

function renderCreate(
  overrides: Partial<Parameters<typeof CategoryForm>[0]> = {},
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  renderWithProviders(
    <CategoryForm
      mode="create"
      defaultSortOrder={3}
      submitting={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSubmit, onCancel }
}

describe('CategoryForm', () => {
  it('validates required name, hex color, and whole-number sort order', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate()

    await user.click(screen.getByRole('button', { name: 'Save category' }))
    expect(await screen.findByText('Enter a category name.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name'), 'Snacks')
    const hex = screen.getByLabelText('Color hex')
    await user.clear(hex)
    await user.type(hex, 'red')
    await user.click(screen.getByRole('button', { name: 'Save category' }))
    expect(
      await screen.findByText('Color must be a hex value like #AABBCC.'),
    ).toBeInTheDocument()

    await user.clear(hex)
    await user.type(hex, '#22AA66')
    const sort = screen.getByLabelText('Sort order')
    await user.clear(sort)
    await user.type(sort, '1.5')
    await user.click(screen.getByRole('button', { name: 'Save category' }))
    expect(
      await screen.findByText('Sort order must be a whole number.'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('opens an icon-only picker, keeps the selection on cancel, and submits the chosen key', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate()

    await user.type(screen.getByLabelText('Name'), 'Clinic')
    const trigger = screen.getByRole('button', { name: /Choose icon \(Other\)/ })
    expect(trigger).toHaveAttribute('data-icon-key', 'other')
    for (const name of VISIBLE_ICON_NAMES) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }

    await user.click(trigger)
    const picker = await screen.findByRole('dialog', { name: 'Choose an icon' })
    expect(picker).toHaveAttribute('data-slot', 'dialog-content')
    expect(picker).toHaveAttribute('data-category-icon-picker')
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()

    const selected = within(picker).getByRole('button', { name: 'Other' })
    expect(selected).toHaveAttribute('data-selected', 'true')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).not.toHaveTextContent('Other')
    for (const name of VISIBLE_ICON_NAMES) {
      expect(within(picker).queryByText(name)).not.toBeInTheDocument()
    }

    await user.click(within(picker).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Choose an icon' }),
      ).not.toBeInTheDocument()
    })
    expect(trigger).toHaveAttribute('data-icon-key', 'other')
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })

    await user.click(trigger)
    const reopened = await screen.findByRole('dialog', { name: 'Choose an icon' })
    await user.click(within(reopened).getByRole('button', { name: 'Health' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Choose an icon' }),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /Choose icon \(Health\)/ }),
    ).toHaveAttribute('data-icon-key', 'health')

    await user.click(screen.getByRole('button', { name: 'Save category' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Clinic',
        color: '#64748B',
        iconKey: 'health',
        sortOrder: 3,
      })
    })
  })

  it('preserves the existing icon when editing and closing the picker with Escape', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <CategoryForm
        mode="edit"
        category={sampleCategories[1]}
        defaultSortOrder={9}
        submitting={false}
        error={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: /Choose icon \(Transport\)/,
    })
    expect(trigger).toHaveAttribute('data-icon-key', 'transport')
    expect(screen.getByLabelText('Name')).toHaveValue('Transport')

    await user.click(trigger)
    const picker = await screen.findByRole('dialog', { name: 'Choose an icon' })
    expect(
      within(picker).getByRole('button', { name: 'Transport' }),
    ).toHaveAttribute('data-selected', 'true')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Choose an icon' }),
      ).not.toBeInTheDocument()
    })
    expect(trigger).toHaveAttribute('data-icon-key', 'transport')
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Transport',
        color: '#112233',
        iconKey: 'transport',
        sortOrder: 2,
      })
    })
  })

  it('searches icons, saves a selection and restores it when the picker reopens', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate()

    await user.type(screen.getByLabelText('Name'), 'Streaming')
    const trigger = screen.getByRole('button', { name: /Choose icon \(Other\)/ })
    await user.click(trigger)

    const picker = await screen.findByRole('dialog', { name: 'Choose an icon' })
    await waitFor(() => {
      expect(within(picker).getByRole('searchbox', { name: 'Search icons by name' })).toHaveFocus()
    })
    await user.type(within(picker).getByRole('searchbox', { name: 'Search icons by name' }), LAST_ICON_LABEL)
    const lastIcon = within(picker).getByRole('button', { name: LAST_ICON_LABEL })
    expect(lastIcon).toHaveAttribute('data-icon-key', LAST_ICON_KEY)
    await user.click(lastIcon)

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Choose an icon' }),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: new RegExp(`Choose icon \\(${LAST_ICON_LABEL}\\)`) }),
    ).toHaveAttribute('data-icon-key', LAST_ICON_KEY)

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`Choose icon \\(${LAST_ICON_LABEL}\\)`),
      }),
    )
    const reopened = await screen.findByRole('dialog', { name: 'Choose an icon' })
    const selected = within(reopened).getByRole('button', { name: LAST_ICON_LABEL })
    expect(selected).toHaveAttribute('data-selected', 'true')
    expect(selected).toHaveAttribute('data-icon-key', LAST_ICON_KEY)
    await waitFor(() => {
      expect(within(reopened).getByRole('searchbox', { name: 'Search icons by name' })).toHaveFocus()
    })
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Save category' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Streaming',
        color: '#64748B',
        iconKey: LAST_ICON_KEY,
        sortOrder: 3,
      })
    })
  })
})
