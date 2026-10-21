import type { CSSProperties, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

type ChartViewportProps = {
  children: ReactNode
  className?: string
  heightClassName?: string
  height?: number
}

export function ChartViewport({
  children,
  className,
  heightClassName = 'h-64 min-h-[16rem]',
  height,
}: ChartViewportProps) {
  const sized = height != null
  const style: CSSProperties | undefined = sized
    ? { height, minHeight: height }
    : undefined

  return (
    <div
      className={cn(
        'w-full min-w-0',
        sized ? undefined : heightClassName,
        className,
      )}
      style={style}
      data-chart-viewport="true"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={sized ? height : 256}
        debounce={0}
        initialDimension={{ width: 320, height: sized ? height : 256 }}
      >
        {children}
      </ResponsiveContainer>
    </div>
  )
}
