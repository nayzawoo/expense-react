import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/errors'
import {
  incomeErrorKey,
  isValidIncomeAmount,
  normalizeIncomeNote,
  normalizeIncomeReason,
} from '@/lib/income-errors'
import { MAX_MONEY_ABS } from '@/lib/money'

describe('isValidIncomeAmount', () => {
  it('accepts whole positive amounts inside the money bound', () => {
    expect(isValidIncomeAmount('1')).toBe(true)
    expect(isValidIncomeAmount('2500')).toBe(true)
    expect(isValidIncomeAmount(MAX_MONEY_ABS.toString())).toBe(true)
  })

  it('rejects zero, signed, fractional, and out-of-range values', () => {
    expect(isValidIncomeAmount('0')).toBe(false)
    expect(isValidIncomeAmount('-10')).toBe(false)
    expect(isValidIncomeAmount('12.5')).toBe(false)
    expect(isValidIncomeAmount('01')).toBe(false)
    expect(isValidIncomeAmount((MAX_MONEY_ABS + 1n).toString())).toBe(false)
  })
})

describe('incomeErrorKey', () => {
  it('maps Spring income codes to incomes.errors keys', () => {
    expect(incomeErrorKey(new ApiError(400, 'FUTURE_DATE'))).toBe(
      'incomes.errors.futureDate',
    )
    expect(incomeErrorKey(new ApiError(400, 'DATE_BEFORE_OPENING'))).toBe(
      'incomes.errors.dateBeforeOpening',
    )
    expect(incomeErrorKey(new ApiError(400, 'ACCOUNT_NOT_ACTIVE'))).toBe(
      'incomes.errors.accountNotActive',
    )
    expect(incomeErrorKey(new ApiError(400, 'BENEFICIARY_NOT_ACTIVE'))).toBe(
      'incomes.errors.beneficiaryNotActive',
    )
    expect(incomeErrorKey(new ApiError(400, 'MONEY_OUT_OF_RANGE'))).toBe(
      'incomes.errors.invalidAmount',
    )
    expect(incomeErrorKey(new ApiError(409, 'IDEMPOTENCY_KEY_REUSED'))).toBe(
      'incomes.errors.idempotency',
    )
    expect(incomeErrorKey(new ApiError(412, 'VERSION_MISMATCH'))).toBe(
      'incomes.errors.versionMismatch',
    )
  })
})

describe('income note and reason', () => {
  it('trims a single-line note and rejects line breaks', () => {
    expect(normalizeIncomeNote('  Salary  ')).toBe('Salary')
    expect(normalizeIncomeNote('')).toBe('')
    expect(normalizeIncomeNote('one\nline')).toBeNull()
  })

  it('requires a trimmed single-line void reason', () => {
    expect(normalizeIncomeReason('  Entered twice  ')).toBe('Entered twice')
    expect(normalizeIncomeReason('   ')).toBeNull()
    expect(normalizeIncomeReason('bad\rreason')).toBeNull()
  })
})
