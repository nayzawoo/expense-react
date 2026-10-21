import { isApiError } from '@/api/errors'
import { ADJUSTMENT_REASON_MAX } from '@/api/adjustments'
import { idempotencyClientErrorKey } from '@/lib/idempotency'
import {
  isSignedMoneyInRange,
  isSignedMoneyString,
  parseSignedMoney,
  subtractSignedMoney,
} from '@/lib/money'

export function adjustmentErrorKey(error: unknown): string {
  const recoveryKey = idempotencyClientErrorKey(error)
  if (recoveryKey) {
    return recoveryKey
  }
  if (error instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(error)) {
    return 'accounts.adjust.errors.generic'
  }

  const detail = (error.code ?? error.message ?? '').trim()
  switch (detail) {
    case 'BALANCE_CHANGED':
      return 'accounts.adjust.errors.balanceChanged'
    case 'ZERO_DELTA':
      return 'accounts.adjust.errors.zeroDelta'
    case 'ACCOUNT_NOT_ACTIVE':
      return 'accounts.adjust.errors.accountNotActive'
    case 'ADJUSTMENT_OUT_OF_RANGE':
    case 'MONEY_OUT_OF_RANGE':
      return 'accounts.adjust.errors.outOfRange'
    case 'INVALID_MONEY':
    case 'MONEY_FRACTION_NOT_ALLOWED':
      return 'accounts.adjust.errors.invalidBalance'
    case 'VERSION_MISMATCH':
      return 'accounts.adjust.errors.versionMismatch'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'accounts.adjust.errors.idempotency'
    default:
      break
  }

  if (error.status === 403) {
    return 'accounts.adjust.errors.forbidden'
  }
  if (error.status === 404) {
    return 'accounts.adjust.errors.notFound'
  }
  if (error.status === 409) {
    return 'accounts.adjust.errors.conflict'
  }
  if (error.status === 412 || error.status === 428) {
    return 'accounts.adjust.errors.versionMismatch'
  }
  if (error.status === 400 || error.status === 422) {
    return 'accounts.adjust.errors.invalid'
  }

  return 'accounts.adjust.errors.generic'
}

export function isBalanceChangedError(error: unknown): boolean {
  return adjustmentErrorKey(error) === 'accounts.adjust.errors.balanceChanged'
}

export function normalizeAdjustmentReason(value: string): string | null {
  const reason = value.trim()
  if (!reason || reason.length > ADJUSTMENT_REASON_MAX) {
    return null
  }
  if (reason.includes('\n') || reason.includes('\r')) {
    return null
  }
  return reason
}

export function validateActualBalance(
  actualBalance: string,
  currentBalance: string,
): string | null {
  if (!isSignedMoneyString(actualBalance)) {
    return 'accounts.adjust.invalidBalance'
  }
  const actual = parseSignedMoney(actualBalance)
  if (actual === null || !isSignedMoneyInRange(actual)) {
    return 'accounts.adjust.outOfRange'
  }
  const delta = subtractSignedMoney(actualBalance, currentBalance)
  if (delta === null) {
    return 'accounts.adjust.invalidBalance'
  }
  if (delta === '0') {
    return 'accounts.adjust.zeroDelta'
  }
  const deltaValue = parseSignedMoney(delta)
  if (deltaValue === null || !isSignedMoneyInRange(deltaValue)) {
    return 'accounts.adjust.outOfRange'
  }
  return null
}
