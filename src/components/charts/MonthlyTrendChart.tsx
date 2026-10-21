import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { PageEmptyState } from '@/components/PageEmptyState'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ChartViewport } from '@/components/charts/ChartViewport'
import { CHART_SERIES } from '@/components/charts/chart-theme'
import type { MonthTrendPoint } from '@/api/types'
import {
  chartTickLabel,
  hasPlottableValues,
  monthAxisLabel,
  toMonthlyTrendPoints,
} from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'

type MonthlyTrendChartProps = {
  points: MonthTrendPoint[]
  currency: string
}

export function MonthlyTrendChart({
  points,
  currency,
}: MonthlyTrendChartProps) {
  const { t, i18n } = useTranslation()
  const data = toMonthlyTrendPoints(points, currency)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const includeYear = new Set(data.map((point) => point.month.slice(0, 4))).size > 1
  const chartData = data.map((point) => ({
    ...point,
    axisLabel: monthAxisLabel(point.month, locale, includeYear),
  }))
  const hasValues = hasPlottableValues(data.map((point) => point.value))

  if (points.length === 0) {
    return (
      <PageEmptyState
        icon={BarChart3}
        message={t('reports.monthlyTrendEmpty')}
      />
    )
  }

  return (
    <figure className="min-w-0" data-chart="monthly-trend">
      <figcaption className="sr-only">{t('reports.monthlyTrend')}</figcaption>
      {hasValues ? (
        <ChartViewport heightClassName="h-72 min-h-[18rem]">
          <BarChart
            data={chartData}
            accessibilityLayer
            margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
          >
            <CartesianGrid stroke={CHART_SERIES.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="axisLabel"
              tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
              axisLine={{ stroke: CHART_SERIES.axis }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={chartTickLabel}
              tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
              axisLine={{ stroke: CHART_SERIES.axis }}
              tickLine={false}
              width={48}
            />
            <ChartTooltip />
            <Bar
              dataKey="value"
              name={t('charts.series.expense')}
              fill={CHART_SERIES.expense}
              isAnimationActive={false}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartViewport>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('reports.monthlyTrendEmpty')}
        </p>
      )}
      <ul className="mt-3 grid gap-2 text-sm">
        {data.map((point) => (
          <li
            key={point.month}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium">{point.month}</span>
              {point.isPartial ? (
                <Badge variant="outline">{t('reports.partialMonth')}</Badge>
              ) : null}
              <Badge
                variant={point.coverage === 'COMPLETE' ? 'secondary' : 'outline'}
              >
                {t(`reports.monthCoverage.${point.coverage}`, {
                  defaultValue: point.coverage,
                })}
              </Badge>
            </div>
            <span className="tabular-nums text-muted-foreground">
              {point.amounts.expense == null
                ? t('reports.notAvailable')
                : formatMoney(point.amounts.expense, currency)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
