import type { Expense } from '@/api/expenses'

export function groupExpensesByDate(expenses: Expense[]) {
  const groups = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const group = groups.get(expense.effectiveDate)
    if (group) {
      group.push(expense)
    } else {
      groups.set(expense.effectiveDate, [expense])
    }
  }
  return [...groups].sort(([left], [right]) => right.localeCompare(left))
}

/** Format a calendar date without shifting it into the browser's timezone. */
export function formatExpenseDate(date: string): string {
  const [year, month, day] = date.split('-')
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
  return `${day}-${month}-${year} (${weekday})`
}
