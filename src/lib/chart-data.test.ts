import { describe, expect, it } from 'vitest'

import type {
  CategoryBreakdownRow,
  CategoryChanges,
  DashboardAccountBalance,
  MonthTrendPoint,
  SpendingPacePoint,
} from '@/api/types'
import {
  chartDomain,
  monthAxisLabel,
  pieCategoryShares,
  toBalanceBarPoints,
  toCategoryChangeChartPoints,
  toCategorySharePoints,
  toChartNumber,
  toIncomeExpensePoints,
  toMonthlyTrendPoints,
  toPaceChartPoints,
  truncateLabel,
  VERTICAL_BAR_CHART_PADDING,
  VERTICAL_BAR_ROW_HEIGHT,
  VERTICAL_BAR_VIEWPORT_MAX,
  verticalBarInnerHeight,
} from '@/lib/chart-data'

describe('toChartNumber', () => {
  it('keeps null, blank, and non-finite values as gaps', () => {
    expect(toChartNumber(null)).toBeNull()
    expect(toChartNumber(undefined)).toBeNull()
    expect(toChartNumber('')).toBeNull()
    expect(toChartNumber('abc')).toBeNull()
  })

  it('preserves true zero and negatives for geometry', () => {
    expect(toChartNumber('0')).toBe(0)
    expect(toChartNumber('-50')).toBe(-50)
    expect(toChartNumber('1250')).toBe(1250)
  })
})

describe('toPaceChartPoints', () => {
  const points: SpendingPacePoint[] = [
    {
      day: 1,
      currentCumulative: '0',
      previousCumulative: '40',
      expense: '0',
    },
    {
      day: 2,
      currentCumulative: null,
      previousCumulative: '90',
      expense: null,
    },
    {
      day: 3,
      currentCumulative: '120',
      previousCumulative: null,
      expense: '120',
    },
  ]

  it('omits previous values when comparison coverage is incomplete', () => {
    const rows = toPaceChartPoints(points, false)
    expect(rows[0]?.previous).toBeNull()
    expect(rows[0]?.amounts.previous).toBeNull()
    expect(rows[0]?.current).toBe(0)
    expect(rows[0]?.amounts.current).toBe('0')
    expect(rows[1]?.current).toBeNull()
    expect(rows[1]?.amounts.current).toBeNull()
    expect(rows[1]?.amounts.expense).toBeNull()
  })

  it('keeps previous zeros and gaps when comparison coverage is complete', () => {
    const rows = toPaceChartPoints(points, true)
    expect(rows[0]?.previous).toBe(40)
    expect(rows[0]?.amounts.previous).toBe('40')
    expect(rows[2]?.previous).toBeNull()
    expect(rows[2]?.amounts.previous).toBeNull()
    expect(rows[2]?.amounts.current).toBe('120')
  })
})

describe('category share points', () => {
  const rows: CategoryBreakdownRow[] = [
    {
      category: { id: 'food', name: 'Food' },
      amount: '500',
      sharePercent: '62.5',
    },
    {
      category: { id: 'zero', name: 'Zero' },
      amount: '0',
      sharePercent: '0',
    },
    {
      category: { id: 'gap', name: 'Gap' },
      amount: '',
      sharePercent: '0',
    },
  ]

  it('keeps exact amount and share strings for display', () => {
    const points = toCategorySharePoints(rows, 'MMK')
    expect(points[0]?.amounts.amount).toBe('500')
    expect(points[0]?.amounts.share).toBe('62.5')
    expect(points[1]?.value).toBe(0)
    expect(points[1]?.amount).toBe('0')
  })

  it('drops null and non-positive values from pie geometry', () => {
    const pie = pieCategoryShares(toCategorySharePoints(rows, 'MMK'))
    expect(pie.map((row) => row.id)).toEqual(['food'])
  })
})

describe('toMonthlyTrendPoints', () => {
  const points: MonthTrendPoint[] = [
    {
      month: '2026-05',
      expense: null,
      isPartial: false,
      coverage: 'UNCOVERED',
    },
    {
      month: '2026-06',
      expense: '0',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-10',
      expense: '800',
      isPartial: true,
      coverage: 'COMPLETE',
    },
  ]

  it('keeps uncovered months as gaps instead of zero', () => {
    const rows = toMonthlyTrendPoints(points, 'MMK')
    expect(rows[0]?.value).toBeNull()
    expect(rows[0]?.amounts.expense).toBeNull()
    expect(rows[1]?.value).toBe(0)
    expect(rows[1]?.amounts.expense).toBe('0')
    expect(rows[2]?.amounts.expense).toBe('800')
    expect(rows[2]?.isPartial).toBe(true)
  })
})

describe('toIncomeExpensePoints and balances', () => {
  it('uses exact overview strings including zero', () => {
    const rows = toIncomeExpensePoints(
      { income: '0', expense: '350' },
      'MMK',
      { income: 'Income', expense: 'Expense' },
    )
    expect(rows[0]?.value).toBe(0)
    expect(rows[0]?.amounts.amount).toBe('0')
    expect(rows[1]?.amounts.amount).toBe('350')
  })

  it('marks negative balances without mutating the amount string', () => {
    const accounts: DashboardAccountBalance[] = [
      {
        id: 'cash',
        name: 'Cash',
        balance: '1250',
        negativeBalanceWarning: false,
      },
      {
        id: 'wallet',
        name: 'Wallet',
        balance: '-50',
        negativeBalanceWarning: true,
      },
    ]
    const rows = toBalanceBarPoints(accounts, 'MMK')
    expect(rows[0]?.tone).toBe('default')
    expect(rows[1]?.tone).toBe('negative')
    expect(rows[1]?.value).toBe(-50)
    expect(rows[1]?.amounts.amount).toBe('-50')
  })
})

describe('toCategoryChangeChartPoints', () => {
  it('charts only the changed-category subset with exact current/previous strings', () => {
    const changes: CategoryChanges = {
      increased: [
        {
          category: { id: 'food', name: 'Food' },
          currentAmount: '500',
          previousAmount: '200',
          difference: '300',
          differencePercent: '150.0',
          isNew: false,
        },
      ],
      decreased: [
        {
          category: { id: 'bills', name: 'Bills' },
          currentAmount: '0',
          previousAmount: '250',
          difference: '-250',
          differencePercent: '-100.0',
          isNew: false,
        },
      ],
    }
    const rows = toCategoryChangeChartPoints(changes, 'MMK')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.amounts.current).toBe('500')
    expect(rows[0]?.amounts.previous).toBe('200')
    expect(rows[1]?.current).toBe(0)
    expect(rows[1]?.amounts.current).toBe('0')
    expect(rows[1]?.direction).toBe('down')
  })
})

describe('chartDomain', () => {
  it('includes zero and keeps a span for all-zero or one-point series', () => {
    expect(chartDomain([0, 0])).toEqual([0, 1])
    expect(chartDomain([150])).toEqual([0, 150])
    expect(chartDomain([-50])).toEqual([-50, 0])
    expect(chartDomain([null, undefined])).toEqual([0, 1])
    expect(chartDomain([-50, 1250])).toEqual([-50, 1250])
  })
})

describe('truncateLabel', () => {
  it('leaves short labels intact and shortens long names', () => {
    expect(truncateLabel('Food')).toBe('Food')
    expect(truncateLabel('Very Long Category Name', 10)).toBe('Very Long…')
  })
})

describe('monthAxisLabel', () => {
  it('uses a short localized month and can include a two-digit year', () => {
    expect(monthAxisLabel('2026-05', 'en', false)).toBe('May')
    expect(monthAxisLabel('2026-10', 'en', true)).toBe('Oct 26')
    expect(monthAxisLabel('not-a-month', 'en')).toBe('not-a-month')
    const myanmar = monthAxisLabel('2026-05', 'my')
    expect(myanmar).not.toBe('2026-05')
    expect(myanmar.length).toBeLessThan(8)
  })
})

describe('verticalBarInnerHeight', () => {
  it('grows with row count instead of compressing many bars into a fixed box', () => {
    expect(verticalBarInnerHeight(2)).toBe(256)
    expect(verticalBarInnerHeight(20)).toBe(
      20 * VERTICAL_BAR_ROW_HEIGHT + VERTICAL_BAR_CHART_PADDING,
    )
    expect(verticalBarInnerHeight(20)).toBeGreaterThan(VERTICAL_BAR_VIEWPORT_MAX)
  })
})
