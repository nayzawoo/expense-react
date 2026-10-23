import { describe, expect, it } from 'vitest'

import { accountIconSrc } from '@/lib/account-icon'

describe('accountIconSrc', () => {
  it('matches common Myanmar brand names case-insensitively', () => {
    expect(accountIconSrc({ name: 'KBZ', type: 'BANK' })).toBe(
      '/account-icons/kbz.svg',
    )
    expect(accountIconSrc({ name: 'Kpay', type: 'WALLET' })).toBe(
      '/account-icons/kpay.svg',
    )
    expect(accountIconSrc({ name: 'Wave Money', type: 'WALLET' })).toBe(
      '/account-icons/wave.svg',
    )
    expect(accountIconSrc({ name: 'AYA Pay', type: 'WALLET' })).toBe(
      '/account-icons/aya.svg',
    )
  })

  it('falls back to the account type badge when no brand matches', () => {
    expect(accountIconSrc({ name: 'Cash', type: 'CASH' })).toBe(
      '/account-icons/cash.svg',
    )
    expect(accountIconSrc({ name: 'Shared Wallet', type: 'WALLET' })).toBe(
      '/account-icons/wallet.svg',
    )
    expect(accountIconSrc({ name: 'Joint Bank', type: 'BANK' })).toBe(
      '/account-icons/bank.svg',
    )
  })
})
