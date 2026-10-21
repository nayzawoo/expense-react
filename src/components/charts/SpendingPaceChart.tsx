import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import type { SpendingPacePoint } from '@/api/types'
import { PageEmptyState } from '@/components/PageEmptyState'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ChartViewport } from '@/components/charts/ChartViewport'
import { CHART_SERIES } from '@/components/charts/chart-theme'
import {
  chartTickLabel,
  hasPlottableValues,
  toPaceChartPoints,
} from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'

type SpendingPaceChartProps = {
  points: SpendingPacePoint[]
  comparisonComplete: boolean
  currency: string
}

export function SpendingPaceChart({
  points,
  comparisonComplete,
  currency,
}: SpendingPaceChartProps) {
  const { t } = useTranslation()
  const data = toPaceChartPoints(points, comparisonComplete).map((point) => ({
    ...point,
    currency,
  }))
  const hasCurrent = hasPlottableValues(data.map((point) => point.current))
  const hasPrevious = hasPlottableValues(data.map((point) => point.previous))

  if (!hasCurrent && !hasPrevious) {
    return (
      <PageEmptyState
        icon={TrendingUp}
        message={t('dashboard.spendingPaceEmpty')}
      />
    )
  }

  return (
    <figure className="min-w-0" data-chart="spending-pace">
      <figcaption className="sr-only">{t('dashboard.spendingPace')}</figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-foreground" aria-hidden />
          {t('charts.series.current')}
        </span>
        {hasPrevious ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-4 border-t border-dashed border-muted-foreground"
              aria-hidden
            />
            {t('charts.series.previous')}
          </span>
        ) : comparisonComplete ? null : (
          <span>{t('dashboard.comparisonIncomplete')}</span>
        )}
      </div>
      <ChartViewport>
        <LineChart
          data={data}
          accessibilityLayer
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={CHART_SERIES.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
            axisLine={{ stroke: CHART_SERIES.axis }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={chartTickLabel}
            tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
            axisLine={{ stroke: CHART_SERIES.axis }}
            tickLine={false}
            width={48}
          />
          <ChartTooltip />
          {hasPrevious ? (
            <Line
              type="linear"
              dataKey="previous"
              name={t('charts.series.previous')}
              stroke={CHART_SERIES.previous}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          {hasCurrent ? (
            <Line
              type="linear"
              dataKey="current"
              name={t('charts.series.current')}
              stroke={CHART_SERIES.current}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ChartViewport>
      <table className="sr-only">
        <caption>{t('dashboard.spendingPace')}</caption>
        <thead>
          <tr>
            <th>{t('charts.series.day')}</th>
            <th>{t('charts.series.current')}</th>
            <th>{t('charts.series.previous')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              <td>
                {point.amounts.current == null
                  ? t('charts.notAvailable')
                  : formatMoney(point.amounts.current, currency)}
              </td>
              <td>
                {point.amounts.previous == null
                  ? t('charts.notAvailable')
                  : formatMoney(point.amounts.previous, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
