import { PieChart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'

import { PageEmptyState } from '@/components/PageEmptyState'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ChartViewport } from '@/components/charts/ChartViewport'
import { CHART_SERIES } from '@/components/charts/chart-theme'
import type { CategoryChanges } from '@/api/types'
import {
  chartTickLabel,
  hasPlottableValues,
  toCategoryChangeChartPoints,
  truncateLabel,
} from '@/lib/chart-data'

type CategoryChangesChartProps = {
  changes: CategoryChanges
  currency: string
}

export function CategoryChangesChart({
  changes,
  currency,
}: CategoryChangesChartProps) {
  const { t } = useTranslation()
  const data = toCategoryChangeChartPoints(changes, currency).map((row) => ({
    ...row,
    currency,
  }))
  const hasValues = hasPlottableValues(
    data.flatMap((row) => [row.current, row.previous]),
  )

  if (data.length === 0) {
    return (
      <PageEmptyState icon={PieChart} message={t('reports.changesEmpty')} />
    )
  }

  if (!hasValues) {
    return (
      <PageEmptyState icon={PieChart} message={t('reports.changesEmpty')} />
    )
  }

  return (
    <figure className="min-w-0" data-chart="category-changes">
      <figcaption className="sr-only">{t('reports.categoryChanges')}</figcaption>
      <ChartViewport heightClassName="h-72 min-h-[18rem]">
        <BarChart
          data={data}
          layout="vertical"
          accessibilityLayer
          margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
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
            width={96}
            tickFormatter={(value: string) => truncateLabel(value, 14)}
            tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
            axisLine={{ stroke: CHART_SERIES.axis }}
            tickLine={false}
          />
          <ChartTooltip />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value) =>
              value === 'previous'
                ? t('charts.series.previous')
                : t('charts.series.current')
            }
          />
          <Bar
            dataKey="previous"
            name="previous"
            fill={CHART_SERIES.previous}
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="current"
            name="current"
            fill={CHART_SERIES.current}
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
          />
        </BarChart>
      </ChartViewport>
    </figure>
  )
}
