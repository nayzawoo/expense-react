/** Spring Money.MAX_ABS — 17-digit whole units. */
export const MAX_MONEY_ABS = 99999999999999999n

/** Whole signed MMK string including zero (Spring Money.parseSignedOpening). */
export function isSignedMoneyString(value: string): boolean {
  return /^-?(0|[1-9]\d*)$/.test(value.trim())
}

export function parseSignedMoney(value: string): bigint | null {
  const text = value.trim()
  if (!isSignedMoneyString(text)) {
    return null
  }
  try {
    return BigInt(text)
  } catch {
    return null
  }
}

export function isSignedMoneyInRange(value: bigint): boolean {
  return value <= MAX_MONEY_ABS && value >= -MAX_MONEY_ABS
}

/** Exact signed delta `actual - current` using integer arithmetic. */
export function subtractSignedMoney(
  actual: string,
  current: string,
): string | null {
  const left = parseSignedMoney(actual)
  const right = parseSignedMoney(current)
  if (left === null || right === null) {
    return null
  }
  return (left - right).toString()
}

/** Format whole-unit money strings with Western digits, e.g. `1,000 MMK`. */
export function formatMoney(amount: string, currency: string): string {
  const negative = amount.startsWith('-')
  const raw = negative ? amount.slice(1) : amount
  if (!/^\d+$/.test(raw)) {
    return `${amount} ${currency}`.trim()
  }
  const grouped = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped} ${currency}`
}

/** Signed delta display with an explicit plus for increases. */
export function formatSignedDelta(amount: string, currency: string): string {
  const formatted = formatMoney(amount, currency)
  if (amount.startsWith('-') || amount === '0' || amount === '-0') {
    return formatted
  }
  return `+${formatted}`
}
