import { describe, expect, it } from 'vitest'

import type { Expense } from '@/api/expenses'
import { formatExpenseDate, groupExpensesByDate } from './expense-groups'

describe('expense date groups', () => {
  it('groups nonadjacent matching dates, sorts newest first, and preserves records within each day', () => {
    const rows = [
      { id: 'older', effectiveDate: '2026-10-20' },
      { id: 'today-first', effectiveDate: '2026-10-23' },
      { id: 'oldest', effectiveDate: '2026-09-30' },
      { id: 'today-second', effectiveDate: '2026-10-23' },
    ] as Expense[]
    expect(groupExpensesByDate(rows).map(([date, expenses]) => [date, expenses.map(row => row.id)]))
      .toEqual([
        ['2026-10-23', ['today-first', 'today-second']],
        ['2026-10-20', ['older']],
        ['2026-09-30', ['oldest']],
      ])
    expect(rows[0]!.id).toBe('older')
    expect(groupExpensesByDate([])).toEqual([])
  })

  it('formats the requested day and English weekday without timezone shifts', () => {
    expect(formatExpenseDate('2026-10-20')).toBe('20-10-2026 (Tue)')
    expect(formatExpenseDate('2026-01-01')).toBe('01-01-2026 (Thu)')
  })
})
