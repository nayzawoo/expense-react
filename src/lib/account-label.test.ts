import { describe, expect, it } from 'vitest'

import { accountSelectLabel, shortOwnerLabel } from '@/lib/account-label'

describe('shortOwnerLabel', () => {
  it('keeps an existing short code or initials', () => {
    expect(shortOwnerLabel('NZO')).toBe('NZO')
    expect(shortOwnerLabel(' nzo ')).toBe('nzo')
    expect(shortOwnerLabel('N Z O')).toBe('NZO')
    expect(shortOwnerLabel('Shared')).toBe('Shared')
  })

  it('derives initials from a multi-word owner name', () => {
    expect(shortOwnerLabel('Nay Zaw Oo')).toBe('NZO')
    expect(shortOwnerLabel('Ma Hnin')).toBe('MH')
    expect(shortOwnerLabel('someone else')).toBe('SE')
    expect(shortOwnerLabel('NayZawOo')).toBe('NZO')
  })

  it('returns an empty string when the owner is blank', () => {
    expect(shortOwnerLabel('   ')).toBe('')
  })
})

describe('accountSelectLabel', () => {
  it('joins the account name and short owner without a space', () => {
    expect(
      accountSelectLabel({ name: 'KBZ', ownerLabel: 'Nay Zaw Oo' }),
    ).toBe('KBZ(NZO)')
    expect(accountSelectLabel({ name: 'Kpay', ownerLabel: 'NZO' })).toBe(
      'Kpay(NZO)',
    )
    expect(
      accountSelectLabel({ name: 'Kpay', ownerLabel: 'Ma Hnin' }),
    ).toBe('Kpay(MH)')
  })

  it('uses the name alone when there is no owner label', () => {
    expect(accountSelectLabel({ name: 'Cash', ownerLabel: '' })).toBe('Cash')
  })
})
