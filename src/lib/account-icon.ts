import type { Account, AccountType } from '@/api/types'

const TYPE_ICON_SRC: Record<AccountType, string> = {
  BANK: '/account-icons/bank.svg',
  WALLET: '/account-icons/wallet.svg',
  CASH: '/account-icons/cash.svg',
}

/**
 * Brand letter-mark images matched from the account name.
 * Order matters: longer / more specific tokens first.
 */
const BRAND_ICON_MATCHERS: ReadonlyArray<{ pattern: RegExp; src: string }> = [
  { pattern: /k\s*pay|kbz\s*pay/i, src: '/account-icons/kpay.svg' },
  { pattern: /kbz/i, src: '/account-icons/kbz.svg' },
  { pattern: /wave/i, src: '/account-icons/wave.svg' },
  { pattern: /aya/i, src: '/account-icons/aya.svg' },
  { pattern: /\bcb\b|cb\s*bank|cbpay/i, src: '/account-icons/cb.svg' },
  { pattern: /uab/i, src: '/account-icons/uab.svg' },
  { pattern: /yoma/i, src: '/account-icons/yoma.svg' },
  { pattern: /agd/i, src: '/account-icons/agdbank.svg' },
  { pattern: /\bmab\b/i, src: '/account-icons/mab.svg' },
]

/** Image icon path for an account: brand mark when known, else type badge. */
export function accountIconSrc(
  account: Pick<Account, 'name' | 'type'>,
): string {
  const name = account.name.trim()
  for (const matcher of BRAND_ICON_MATCHERS) {
    if (matcher.pattern.test(name)) {
      return matcher.src
    }
  }
  return TYPE_ICON_SRC[account.type] ?? TYPE_ICON_SRC.WALLET
}
