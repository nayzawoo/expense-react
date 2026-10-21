import { useTranslation } from 'react-i18next'
import type { TooltipContentProps } from 'recharts'

import type { ChartDatum } from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'

const SERIES_ORDER = [
  'current',
  'previous',
  'expense',
  'income',
  'amount',
  'difference',
] as const

function seriesLabel(
  key: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  return t(`charts.series.${key}`, { defaultValue: key })
}

function formatExactAmount(
  amount: string | null | undefined,
  currency: string,
  unavailable: string,
): string {
  if (amount == null || amount === '') {
    return unavailable
  }
  return formatMoney(amount, currency)
}

export function MoneyChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  const { t } = useTranslation()
  if (!active || payload == null || payload.length === 0) {
    return null
  }

  const datum = payload[0]?.payload as ChartDatum | undefined
  if (datum == null) {
    return null
  }

  const unavailable = t('charts.notAvailable')
  const title = datum.label ?? (label == null ? null : String(label))
  const orderedKeys = [
    ...SERIES_ORDER.filter((key) => key in datum.amounts),
    ...Object.keys(datum.amounts).filter(
      (key) => !SERIES_ORDER.includes(key as (typeof SERIES_ORDER)[number]),
    ),
  ]

  return (
    <div
      className="max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      data-chart-tooltip="true"
    >
      {title ? <p className="mb-1.5 font-medium">{title}</p> : null}
      <ul className="grid gap-1">
        {orderedKeys.map((key) => {
          if (key === 'share') {
            const share = datum.amounts.share
            return (
              <li key={key} className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {seriesLabel(key, t)}
                </span>
                <span className="tabular-nums">
                  {share == null || share === '' ? unavailable : `${share}%`}
                </span>
              </li>
            )
          }
          return (
            <li key={key} className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {seriesLabel(key, t)}
              </span>
              <span className="tabular-nums">
                {formatExactAmount(datum.amounts[key], datum.currency, unavailable)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
