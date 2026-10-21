import type {
  BeneficiarySpendingRow,
  CategoryBreakdownRow,
  CategoryChangeRow,
  CategoryChanges,
  DashboardAccountBalance,
  DashboardOverview,
  MonthTrendPoint,
  SpendingPacePoint,
} from '@/api/types'

/** Convert an API decimal string for chart geometry only. Null/blank/non-finite stay gaps. */
export function toChartNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export type ChartAmountMap = Record<string, string | null>

export type ChartDatum = {
  currency: string
  amounts: ChartAmountMap
  label?: string
}

export type PaceChartPoint = ChartDatum & {
  day: number
  current: number | null
  previous: number | null
}

export type CategorySharePoint = ChartDatum & {
  id: string
  name: string
  value: number | null
  amount: string
  sharePercent: string
}

export type MoneyBarPoint = ChartDatum & {
  id: string
  name: string
  value: number | null
  tone: 'income' | 'expense' | 'negative' | 'default'
}

export type TrendChartPoint = ChartDatum & {
  month: string
  value: number | null
  isPartial: boolean
  coverage: string
}

export type CategoryChangeChartPoint = ChartDatum & {
  id: string
  name: string
  current: number | null
  previous: number | null
  difference: string
  differencePercent: string | null
  isNew: boolean
  direction: 'up' | 'down'
}

export function hasPlottableValues(values: Array<number | null | undefined>): boolean {
  return values.some((value) => value != null)
}

export function toPaceChartPoints(
  points: SpendingPacePoint[],
  comparisonComplete: boolean,
): PaceChartPoint[] {
  return points.map((point) => {
    const currentAmount = point.currentCumulative
    const previousAmount = comparisonComplete ? point.previousCumulative : null
    return {
      day: point.day,
      current: toChartNumber(currentAmount),
      previous: toChartNumber(previousAmount),
      currency: '',
      label: String(point.day),
      amounts: {
        current: currentAmount,
        previous: previousAmount,
        expense: point.expense,
      },
    }
  })
}

export function toCategorySharePoints(
  rows: CategoryBreakdownRow[],
  currency: string,
): CategorySharePoint[] {
  return rows.map((row) => ({
    id: row.category.id,
    name: row.category.name,
    value: toChartNumber(row.amount),
    amount: row.amount,
    sharePercent: row.sharePercent,
    currency,
    label: row.category.name,
    amounts: {
      amount: row.amount,
      share: row.sharePercent,
    },
  }))
}

/** Pie slices need a positive finite value; zeros/nulls stay in tables, not as fake slices. */
export function pieCategoryShares(points: CategorySharePoint[]): CategorySharePoint[] {
  return points.filter((point) => point.value != null && point.value > 0)
}

export function toIncomeExpensePoints(
  overview: Pick<DashboardOverview, 'income' | 'expense'>,
  currency: string,
  labels: { income: string; expense: string },
): MoneyBarPoint[] {
  return [
    {
      id: 'income',
      name: labels.income,
      value: toChartNumber(overview.income),
      tone: 'income',
      currency,
      label: labels.income,
      amounts: { amount: overview.income },
    },
    {
      id: 'expense',
      name: labels.expense,
      value: toChartNumber(overview.expense),
      tone: 'expense',
      currency,
      label: labels.expense,
      amounts: { amount: overview.expense },
    },
  ]
}

export function toBalanceBarPoints(
  accounts: DashboardAccountBalance[],
  currency: string,
): MoneyBarPoint[] {
  return accounts.map((account) => {
    const value = toChartNumber(account.balance)
    const negative =
      account.negativeBalanceWarning || (value != null && value < 0)
    return {
      id: account.id,
      name: account.name,
      value,
      tone: negative ? 'negative' : 'default',
      currency,
      label: account.name,
      amounts: { amount: account.balance },
    }
  })
}

export function toBeneficiaryBarPoints(
  rows: BeneficiarySpendingRow[],
  currency: string,
): MoneyBarPoint[] {
  return rows.map((row) => ({
    id: row.beneficiary.id,
    name: row.beneficiary.name,
    value: toChartNumber(row.amount),
    tone: 'expense',
    currency,
    label: row.beneficiary.name,
    amounts: { amount: row.amount },
  }))
}

export function toMonthlyTrendPoints(
  points: MonthTrendPoint[],
  currency: string,
): TrendChartPoint[] {
  return points.map((point) => {
    const uncovered = point.coverage === 'UNCOVERED' || point.expense == null
    const amount = uncovered ? null : point.expense
    return {
      month: point.month,
      value: uncovered ? null : toChartNumber(point.expense),
      isPartial: point.isPartial,
      coverage: point.coverage,
      currency,
      label: point.month,
      amounts: { expense: amount },
    }
  })
}

function toChangePoint(
  row: CategoryChangeRow,
  currency: string,
  direction: 'up' | 'down',
): CategoryChangeChartPoint {
  return {
    id: row.category.id,
    name: row.category.name,
    current: toChartNumber(row.currentAmount),
    previous: toChartNumber(row.previousAmount),
    difference: row.difference,
    differencePercent: row.differencePercent,
    isNew: row.isNew,
    direction,
    currency,
    label: row.category.name,
    amounts: {
      current: row.currentAmount,
      previous: row.previousAmount,
      difference: row.difference,
    },
  }
}

/** API categoryChanges is a changed-category subset (top increases/decreases), not a full history. */
export function toCategoryChangeChartPoints(
  changes: CategoryChanges,
  currency: string,
): CategoryChangeChartPoint[] {
  return [
    ...changes.increased.map((row) => toChangePoint(row, currency, 'up')),
    ...changes.decreased.map((row) => toChangePoint(row, currency, 'down')),
  ]
}

export function truncateLabel(value: string, max = 16): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, Math.max(1, max - 1))}…`
}

/** Short localized axis tick. Keep the original YYYY-MM key for details/tooltips. */
export function monthAxisLabel(
  month: string,
  locale: string,
  includeYear = false,
): string {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0) {
    return month
  }
  const date = new Date(year, monthIndex, 1)
  const localeTag = locale.startsWith('my') ? 'my-MM' : 'en-US'
  const short = date.toLocaleDateString(localeTag, { month: 'short' })
  if (!includeYear) {
    return short
  }
  return `${short} ${String(year).slice(2)}`
}

export const VERTICAL_BAR_ROW_HEIGHT = 36
export const VERTICAL_BAR_CHART_PADDING = 48
export const VERTICAL_BAR_VIEWPORT_MAX = 320

export function verticalBarInnerHeight(rowCount: number): number {
  return Math.max(
    256,
    rowCount * VERTICAL_BAR_ROW_HEIGHT + VERTICAL_BAR_CHART_PADDING,
  )
}

/** Axis ticks are geometry only — never treat these as formatted money. */
export function chartTickLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return ''
  }
  return String(Math.round(value))
}

export function chartDomain(values: Array<number | null | undefined>): [number, number] {
  let min = 0
  let max = 0
  let seen = false
  for (const value of values) {
    if (value == null) {
      continue
    }
    if (!seen) {
      min = value
      max = value
      seen = true
      continue
    }
    if (value < min) min = value
    if (value > max) max = value
  }
  if (!seen) {
    return [0, 1]
  }
  if (min === max) {
    if (min === 0) return [0, 1]
    if (min > 0) return [0, max]
    return [min, 0]
  }
  if (min > 0) min = 0
  if (max < 0) max = 0
  return [min, max]
}
