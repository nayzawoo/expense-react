/**
 * Household-local calendar date as YYYY-MM-DD (no UTC Date#toISOString shift).
 */
export function householdToday(
  timeZone: string,
  now: Date = new Date(),
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA yields YYYY-MM-DD
  return formatter.format(now)
}
