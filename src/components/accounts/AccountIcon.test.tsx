import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { AccountLabel } from './AccountIcon'

it('falls back to a type icon if a brand image fails and recovers for a different account', () => {
  const { container, rerender } = render(<AccountLabel name="KBZ" type="BANK" />)
  const image = container.querySelector('img')!
  expect(image).toHaveAttribute('src', '/images/accounts/kbz.png')
  fireEvent.error(image)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
  expect(screen.getByText('KBZ')).toBeInTheDocument()

  rerender(<AccountLabel name="KPay" type="WALLET" />)
  expect(container.querySelector('img')).toHaveAttribute('src', '/images/accounts/kpay.png')
})

it('uses the cash logo for custom cash account names and a generic icon for unknown banks', () => {
  const { container, rerender } = render(<AccountLabel name="Petty money" type="CASH" />)
  expect(container.querySelector('img')).toHaveAttribute('src', '/images/accounts/cash.png')
  rerender(<AccountLabel name="Savings" type="BANK" />)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('Savings')).toBeInTheDocument()
})
