import { describe, expect, it } from 'vitest'

import { householdToday } from '@/lib/household-date'

describe('householdToday', () => {
  it('uses the household timezone near UTC day boundaries', () => {
    // 2026-03-15 18:30 UTC → still 2026-03-16 in Asia/Yangon (UTC+6:30)
    const instant = new Date('2026-03-15T18:30:00.000Z')
    expect(householdToday('Asia/Yangon', instant)).toBe('2026-03-16')
    expect(householdToday('UTC', instant)).toBe('2026-03-15')
  })

  it('returns YYYY-MM-DD without a time component', () => {
    const value = householdToday('Asia/Yangon', new Date('2026-01-01T00:00:00.000Z'))
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
