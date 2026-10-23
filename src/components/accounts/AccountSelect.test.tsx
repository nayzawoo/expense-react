import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Account } from '@/api/types'
import { AccountSelect } from '@/components/accounts/AccountSelect'
import { sampleAccounts } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const kbz: Account = {
  ...sampleAccounts[0]!,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  name: 'KBZ',
  type: 'BANK',
  ownerLabel: 'Nay Zaw Oo',
}

const kpayNzo: Account = {
  ...sampleAccounts[1]!,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  name: 'Kpay',
  type: 'WALLET',
  ownerLabel: 'NZO',
}

const kpayOther: Account = {
  ...sampleAccounts[1]!,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  name: 'Kpay',
  type: 'WALLET',
  ownerLabel: 'Ma Hnin',
}

describe('AccountSelect', () => {
  it('shows the icon and short label when closed and in the menu', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderWithProviders(
      <AccountSelect
        id="account"
        accounts={[kbz, kpayNzo, kpayOther]}
        value={kbz.id}
        onValueChange={onValueChange}
        emptyLabel="No active accounts"
      />,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('KBZ(NZO)')
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe(
      '/account-icons/kbz.svg',
    )
    expect(trigger.className).toContain('data-[size=default]:h-9')

    await user.click(trigger)

    const kbzOption = await screen.findByRole('option', { name: 'KBZ(NZO)' })
    expect(kbzOption.querySelector('img')?.getAttribute('src')).toBe(
      '/account-icons/kbz.svg',
    )
    const otherKpay = screen.getByRole('option', { name: 'Kpay(MH)' })
    expect(otherKpay.querySelector('img')?.getAttribute('src')).toBe(
      '/account-icons/kpay.svg',
    )
    expect(screen.getByRole('option', { name: 'Kpay(NZO)' })).toBeInTheDocument()

    await user.click(otherKpay)
    expect(onValueChange).toHaveBeenCalledWith(kpayOther.id)
  })

  it('shows the empty label and stays closed when there are no accounts', () => {
    renderWithProviders(
      <AccountSelect
        id="account"
        accounts={[]}
        value=""
        onValueChange={vi.fn()}
        emptyLabel="No active accounts"
      />,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('No active accounts')
    expect(trigger).toBeDisabled()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('shows the only account in the closed value and the menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <AccountSelect
        id="account"
        accounts={[kpayNzo]}
        value={kpayNzo.id}
        onValueChange={vi.fn()}
        emptyLabel="No active accounts"
      />,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Kpay(NZO)')
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe(
      '/account-icons/kpay.svg',
    )

    await user.click(trigger)
    const option = await screen.findByRole('option', { name: 'Kpay(NZO)' })
    expect(option.querySelector('img')?.getAttribute('src')).toBe(
      '/account-icons/kpay.svg',
    )
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })
})
