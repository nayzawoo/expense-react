import { isApiError } from '@/api/errors'
import { idempotencyClientErrorKey } from '@/lib/idempotency'

/** Map Spring expense reason strings / statuses to i18n keys under `expenses.errors.*`. */
export function expenseErrorKey(error: unknown): string {
  const recoveryKey = idempotencyClientErrorKey(error)
  if (recoveryKey) {
    return recoveryKey
  }
  if (error instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(error)) {
    return 'expenses.errors.generic'
  }

  const detail = (error.code ?? error.message ?? '').trim()
  switch (detail) {
    case 'FUTURE_DATE':
      return 'expenses.errors.futureDate'
    case 'DATE_BEFORE_OPENING':
      return 'expenses.errors.dateBeforeOpening'
    case 'INVALID_MONEY':
    case 'MONEY_FRACTION_NOT_ALLOWED':
    case 'MONEY_OUT_OF_RANGE':
      return 'expenses.errors.invalidAmount'
    case 'ACCOUNT_NOT_ACTIVE':
      return 'expenses.errors.accountNotActive'
    case 'CATEGORY_NOT_ACTIVE':
      return 'expenses.errors.categoryNotActive'
    case 'BENEFICIARY_NOT_ACTIVE':
      return 'expenses.errors.beneficiaryNotActive'
    case 'VERSION_MISMATCH':
      return 'expenses.errors.versionMismatch'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'expenses.errors.idempotency'
    default:
      break
  }

  if (error.status === 403) {
    return 'expenses.errors.forbidden'
  }
  if (error.status === 404) {
    return 'expenses.errors.notFound'
  }
  if (error.status === 412 || error.status === 428) {
    return 'expenses.errors.versionMismatch'
  }
  if (error.status === 400) {
    return 'expenses.errors.invalid'
  }

  return 'expenses.errors.generic'
}

/** Whole positive MMK principal string (Spring Money.parsePositivePrincipal). */
export function isPositiveMoneyString(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim())
}
