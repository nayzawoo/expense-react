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
