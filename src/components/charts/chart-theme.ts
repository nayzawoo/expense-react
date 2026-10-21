export const CHART_SLICE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

export const CHART_SERIES = {
  current: 'var(--foreground)',
  previous: 'var(--muted-foreground)',
  income: 'var(--chart-2)',
  expense: 'var(--chart-3)',
  negative: 'var(--destructive)',
  grid: 'var(--border)',
  tick: 'var(--muted-foreground)',
  axis: 'var(--border)',
} as const
