import type { Account } from '@/api/types'

/**
 * Owner token for account menus.
 * An existing short code or single-word label is kept as entered.
 * A multi-word owner name becomes initials, so Nay Zaw Oo is NZO.
 */
export function shortOwnerLabel(ownerLabel: string): string {
  const trimmed = ownerLabel.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return ''
  }

  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return ''
  }

  if (parts.length === 1) {
    const token = parts[0]!
    if (token.length <= 12 || /^[A-Z0-9]+$/.test(token)) {
      return token
    }
    return token.slice(0, 3).toUpperCase()
  }

  if (parts.every((part) => part.length === 1)) {
    return parts.join('').toUpperCase()
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

/** Wallet or bank name, then the short owner, as in KBZ(NZO). */
export function accountSelectLabel(account: Pick<Account, 'name' | 'ownerLabel'>): string {
  const name = account.name.trim()
  const owner = shortOwnerLabel(account.ownerLabel)
  return owner ? `${name}(${owner})` : name
}
