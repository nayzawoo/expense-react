import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/lib/money'

describe('formatMoney', () => {
  it('groups whole-unit amounts with Western digits', () => {
    expect(formatMoney('1000', 'MMK')).toBe('1,000 MMK')
    expect(formatMoney('1250', 'MMK')).toBe('1,250 MMK')
  })

  it('preserves a leading minus for negative balances', () => {
    expect(formatMoney('-50', 'MMK')).toBe('-50 MMK')
    expect(formatMoney('-1250', 'MMK')).toBe('-1,250 MMK')
  })

  it('falls back when the amount is not an integer string', () => {
    expect(formatMoney('12.5', 'MMK')).toBe('12.5 MMK')
  })
})
