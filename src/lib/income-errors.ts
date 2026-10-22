import { isApiError } from '@/api/errors'
import { idempotencyClientErrorKey } from '@/lib/idempotency'
import { isSignedMoneyInRange, parseSignedMoney } from '@/lib/money'

export const INCOME_NOTE_MAX = 2000
export const INCOME_REASON_MAX = 500

/** Map Spring income reason strings / statuses to i18n keys under `incomes.errors.*`. */
export function incomeErrorKey(error: unknown): string {
  const recoveryKey = idempotencyClientErrorKey(error)
  if (recoveryKey) {
    return recoveryKey
  }
  if (error instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(error)) {
    return 'incomes.errors.generic'
  }

  const detail = (error.code ?? error.message ?? '').trim()
  switch (detail) {
    case 'FUTURE_DATE':
      return 'incomes.errors.futureDate'
    case 'DATE_BEFORE_OPENING':
      return 'incomes.errors.dateBeforeOpening'
    case 'INVALID_MONEY':
    case 'MONEY_FRACTION_NOT_ALLOWED':
    case 'MONEY_OUT_OF_RANGE':
      return 'incomes.errors.invalidAmount'
    case 'ACCOUNT_NOT_ACTIVE':
      return 'incomes.errors.accountNotActive'
    case 'BENEFICIARY_NOT_ACTIVE':
      return 'incomes.errors.beneficiaryNotActive'
    case 'VERSION_MISMATCH':
      return 'incomes.errors.versionMismatch'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'incomes.errors.idempotency'
    default:
      break
  }

  if (error.status === 403) {
    return 'incomes.errors.forbidden'
  }
  if (error.status === 404) {
    return 'incomes.errors.notFound'
  }
  if (error.status === 412 || error.status === 428) {
    return 'incomes.errors.versionMismatch'
  }
  if (error.status === 400) {
    return 'incomes.errors.invalid'
  }

  return 'incomes.errors.generic'
}

/** Whole positive MMK principal within Spring Money.MAX_ABS. */
export function isValidIncomeAmount(value: string): boolean {
  const text = value.trim()
  if (!/^[1-9]\d*$/.test(text)) {
    return false
  }
  const parsed = parseSignedMoney(text)
  return parsed !== null && isSignedMoneyInRange(parsed)
}

export function normalizeIncomeNote(value: string): string | null {
  const note = value.trim()
  if (note.includes('\n') || note.includes('\r')) {
    return null
  }
  if (note.length > INCOME_NOTE_MAX) {
    return null
  }
  return note
}

export function normalizeIncomeReason(value: string): string | null {
  const reason = value.trim()
  if (!reason || reason.length > INCOME_REASON_MAX) {
    return null
  }
  if (reason.includes('\n') || reason.includes('\r')) {
    return null
  }
  return reason
}
