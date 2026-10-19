import { isApiError } from '@/api/errors'

/** Map Spring transfer reason strings / statuses to i18n keys under `transfers.errors.*`. */
export function transferErrorKey(error: unknown): string {
  if (error instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(error)) {
    return 'transfers.errors.generic'
  }

  const detail = (error.code ?? error.message ?? '').trim()
  switch (detail) {
    case 'FUTURE_DATE':
      return 'transfers.errors.futureDate'
    case 'DATE_BEFORE_OPENING':
      return 'transfers.errors.dateBeforeOpening'
    case 'SELF_TRANSFER':
      return 'transfers.errors.selfTransfer'
    case 'INVALID_MONEY':
    case 'MONEY_FRACTION_NOT_ALLOWED':
    case 'MONEY_OUT_OF_RANGE':
      return 'transfers.errors.invalidAmount'
    case 'ACCOUNT_NOT_ACTIVE':
      return 'transfers.errors.accountNotActive'
    case 'VERSION_MISMATCH':
      return 'transfers.errors.versionMismatch'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'transfers.errors.idempotency'
    default:
      break
  }

  if (error.status === 403) {
    return 'transfers.errors.forbidden'
  }
  if (error.status === 404) {
    return 'transfers.errors.notFound'
  }
  if (error.status === 412 || error.status === 428) {
    return 'transfers.errors.versionMismatch'
  }
  if (error.status === 400) {
    return 'transfers.errors.invalid'
  }

  return 'transfers.errors.generic'
}
