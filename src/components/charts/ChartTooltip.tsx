import { Tooltip } from 'recharts'

import { MoneyChartTooltip } from '@/components/charts/MoneyChartTooltip'

export function ChartTooltip() {
  return (
    <Tooltip
      content={MoneyChartTooltip}
      isAnimationActive={false}
      allowEscapeViewBox={{ x: true, y: true }}
      wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
    />
  )
}
