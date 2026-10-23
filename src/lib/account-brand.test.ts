import { describe, expect, it } from 'vitest'

import { resolveAccountBrand } from './account-brand'

describe('account branding', () => {
  it.each([
    ['KBZ', 'kbz'],
    [' KBZ — Nay Zaw Oo ', 'kbz'],
    ['KPay', 'kpay'],
    ['KBZPay', 'kpay'],
    ['KBZPay–House', 'kpay'],
    ['KPay Aye Thandar Aung', 'kpay'],
    ['AYA', 'aya'],
    ['AYA Bank', 'aya'],
    ['CB Bank', 'cb'],
    ['Cash', 'cash'],
    ['Cash NZO', 'cash'],
    ['House Cash', 'cash'],
    ['Savings', null],
    ['Cashback', null],
    ['', null],
  ])('resolves %s without confusing bank and wallet brands', (name, expected) => {
    expect(resolveAccountBrand(name)).toBe(expected)
  })
})
