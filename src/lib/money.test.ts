import { describe, expect, it } from 'vitest'

import {
  formatMoney,
  formatSignedDelta,
  isSignedMoneyInRange,
  isSignedMoneyString,
  MAX_MONEY_ABS,
  parseSignedMoney,
  subtractSignedMoney,
} from '@/lib/money'

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

describe('signed money arithmetic', () => {
  it('accepts canonical whole signed strings including zero', () => {
    expect(isSignedMoneyString('0')).toBe(true)
    expect(isSignedMoneyString('-0')).toBe(true)
    expect(isSignedMoneyString('-50')).toBe(true)
    expect(isSignedMoneyString('1250')).toBe(true)
    expect(isSignedMoneyString('12.5')).toBe(false)
    expect(isSignedMoneyString('01')).toBe(false)
    expect(isSignedMoneyString('+10')).toBe(false)
  })

  it('subtracts with exact integer arithmetic', () => {
    expect(subtractSignedMoney('985', '1000')).toBe('-15')
    expect(subtractSignedMoney('1300', '1250')).toBe('50')
    expect(subtractSignedMoney('0', '50')).toBe('-50')
    expect(subtractSignedMoney('-10', '-50')).toBe('40')
    expect(subtractSignedMoney('12.5', '10')).toBeNull()
  })

  it('rejects values outside the shared money bounds', () => {
    expect(isSignedMoneyInRange(MAX_MONEY_ABS)).toBe(true)
    expect(isSignedMoneyInRange(-MAX_MONEY_ABS)).toBe(true)
    expect(isSignedMoneyInRange(MAX_MONEY_ABS + 1n)).toBe(false)
    expect(parseSignedMoney('99999999999999999')).toBe(MAX_MONEY_ABS)
  })

  it('formats signed deltas with an explicit plus', () => {
    expect(formatSignedDelta('50', 'MMK')).toBe('+50 MMK')
    expect(formatSignedDelta('-15', 'MMK')).toBe('-15 MMK')
    expect(formatSignedDelta('0', 'MMK')).toBe('0 MMK')
  })
})
