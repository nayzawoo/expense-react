import { PieChart as PieIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import { PageEmptyState } from '@/components/PageEmptyState'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ChartViewport } from '@/components/charts/ChartViewport'
import { CHART_SERIES, CHART_SLICE_COLORS } from '@/components/charts/chart-theme'
import type { CategoryBreakdownRow } from '@/api/types'
import {
  chartTickLabel,
  pieCategoryShares,
  toCategorySharePoints,
  truncateLabel,
  VERTICAL_BAR_VIEWPORT_MAX,
  verticalBarInnerHeight,
} from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'

type CategoryShareChartProps = {
  rows: CategoryBreakdownRow[]
  currency: string
  emptyLabel: string
  title: string
  showLegend?: boolean
}

const BAR_THRESHOLD = 8

export function CategoryShareChart({
  rows,
  currency,
  emptyLabel,
  title,
  showLegend = true,
}: CategoryShareChartProps) {
  const { t } = useTranslation()
  const points = toCategorySharePoints(rows, currency)
  const pieRows = pieCategoryShares(points)
  const useBars = pieRows.length > BAR_THRESHOLD

  if (pieRows.length === 0) {
    return <PageEmptyState icon={PieIcon} message={emptyLabel} />
  }

  const innerHeight = verticalBarInnerHeight(pieRows.length)
  const scrollManyRows = useBars && innerHeight > VERTICAL_BAR_VIEWPORT_MAX

  return (
    <figure className="min-w-0" data-chart="category-share">
      <figcaption className="sr-only">{title}</figcaption>
      {useBars ? (
        <div
          className={
            scrollManyRows ? 'max-h-80 min-w-0 overflow-y-auto' : 'min-w-0'
          }
          data-chart-scroll={scrollManyRows ? 'true' : undefined}
        >
          <ChartViewport height={innerHeight}>
            <BarChart
              data={pieRows}
              layout="vertical"
              accessibilityLayer
              margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid
                stroke={CHART_SERIES.grid}
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={chartTickLabel}
                tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
                axisLine={{ stroke: CHART_SERIES.axis }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tickFormatter={(value: string) => truncateLabel(value, 12)}
                tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
                axisLine={{ stroke: CHART_SERIES.axis }}
                tickLine={false}
              />
              <ChartTooltip />
              <Bar
                dataKey="value"
                name={t('charts.series.amount')}
                isAnimationActive={false}
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              >
                {pieRows.map((row, index) => (
                  <Cell
                    key={row.id}
                    fill={CHART_SLICE_COLORS[index % CHART_SLICE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartViewport>
        </div>
      ) : (
        <ChartViewport>
          <PieChart accessibilityLayer>
            <Pie
              data={pieRows}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {pieRows.map((row, index) => (
                <Cell
                  key={row.id}
                  fill={CHART_SLICE_COLORS[index % CHART_SLICE_COLORS.length]}
                />
              ))}
            </Pie>
            <ChartTooltip />
          </PieChart>
        </ChartViewport>
      )}
      {showLegend ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {points.map((row) => {
            const pieIndex = pieRows.findIndex((item) => item.id === row.id)
            return (
            <li
              key={row.id}
              className="flex min-w-0 max-w-full items-baseline gap-2"
            >
              <span
                className="mt-0.5 size-2.5 shrink-0 rounded-sm"
                style={{
                  background:
                    pieIndex >= 0
                      ? CHART_SLICE_COLORS[pieIndex % CHART_SLICE_COLORS.length]
                      : 'var(--muted)',
                }}
                aria-hidden
              />
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoney(row.amount, currency)}
                {row.sharePercent ? ` · ${row.sharePercent}%` : null}
              </span>
            </li>
            )
          })}
        </ul>
      ) : null}
    </figure>
  )
}
