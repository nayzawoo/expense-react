export type AccountBrand = 'kbz' | 'kpay' | 'aya' | 'cb' | 'cash'

// Wallet names must be checked before KBZ so KBZPay uses the KPay logo.
export function resolveAccountBrand(name: string): AccountBrand | null {
  const normalized = name.trim().toLowerCase()
  if (/\bcash\b/.test(normalized)) return 'cash'
  if (/\b(kpay|kbzpay)\b/.test(normalized)) return 'kpay'
  if (/\bkbz\b/.test(normalized)) return 'kbz'
  if (/\baya\b/.test(normalized)) return 'aya'
  if (/\bcb\b/.test(normalized)) return 'cb'
  return null
}
