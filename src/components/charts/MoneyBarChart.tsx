import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import { PageEmptyState } from '@/components/PageEmptyState'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ChartViewport } from '@/components/charts/ChartViewport'
import { CHART_SERIES } from '@/components/charts/chart-theme'
import type { MoneyBarPoint } from '@/lib/chart-data'
import {
  chartDomain,
  chartTickLabel,
  hasPlottableValues,
  truncateLabel,
  VERTICAL_BAR_VIEWPORT_MAX,
  verticalBarInnerHeight,
} from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'

type MoneyBarChartProps = {
  items: MoneyBarPoint[]
  currency: string
  title: string
  emptyLabel: string
  layout?: 'horizontal' | 'vertical'
  chartName: string
}

function barFill(tone: MoneyBarPoint['tone']): string {
  if (tone === 'income') return CHART_SERIES.income
  if (tone === 'expense') return CHART_SERIES.expense
  if (tone === 'negative') return CHART_SERIES.negative
  return CHART_SERIES.current
}

export function MoneyBarChart({
  items,
  currency,
  title,
  emptyLabel,
  layout = 'vertical',
  chartName,
}: MoneyBarChartProps) {
  const { t } = useTranslation()
  const data = items.map((item) => ({ ...item, currency }))
  const values = data.map((item) => item.value)

  if (!hasPlottableValues(values)) {
    return <PageEmptyState icon={BarChart3} message={emptyLabel} />
  }

  const domain = chartDomain(values)
  const innerHeight =
    layout === 'vertical' ? verticalBarInnerHeight(data.length) : undefined
  const scrollManyRows =
    innerHeight != null && innerHeight > VERTICAL_BAR_VIEWPORT_MAX
  const hasNegative = values.some((value) => value != null && value < 0)

  return (
    <figure className="min-w-0" data-chart={chartName}>
      <figcaption className="sr-only">{title}</figcaption>
      <div
          className={
          scrollManyRows ? 'max-h-80 min-w-0 overflow-y-auto' : 'min-w-0'
        }
        data-chart-scroll={scrollManyRows ? 'true' : undefined}
      >
        <ChartViewport
          height={innerHeight}
          heightClassName="h-64 min-h-[16rem]"
        >
          <BarChart
            data={data}
            layout={layout}
            accessibilityLayer
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid stroke={CHART_SERIES.grid} strokeDasharray="3 3" />
            {layout === 'vertical' ? (
              <>
                <XAxis
                  type="number"
                  domain={domain}
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
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
                  axisLine={{ stroke: CHART_SERIES.axis }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  type="number"
                  domain={domain}
                  tickFormatter={chartTickLabel}
                  tick={{ fill: CHART_SERIES.tick, fontSize: 12 }}
                  axisLine={{ stroke: CHART_SERIES.axis }}
                  tickLine={false}
                  width={48}
                />
              </>
            )}
            {hasNegative ? (
              <ReferenceLine
                {...(layout === 'vertical' ? { x: 0 } : { y: 0 })}
                stroke={CHART_SERIES.axis}
              />
            ) : null}
            <ChartTooltip />
            <Bar
              dataKey="value"
              name={t('charts.series.amount')}
              isAnimationActive={false}
              radius={layout === 'vertical' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={layout === 'horizontal' ? 64 : 28}
            >
              {data.map((item) => (
                <Cell key={item.id} fill={barFill(item.tone)} />
              ))}
            </Bar>
          </BarChart>
        </ChartViewport>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{t('charts.series.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <th>{item.name}</th>
              <td>
                {item.amounts.amount == null
                  ? t('charts.notAvailable')
                  : formatMoney(item.amounts.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
