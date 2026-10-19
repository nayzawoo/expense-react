import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type PageLoadingProps = {
  rows?: number
  className?: string
}

/** Shared list/section loading skeleton used across feature pages. */
export function PageLoading({ rows = 3, className }: PageLoadingProps) {
  const { t } = useTranslation()
  const widths = ['w-full', 'w-full', 'w-2/3', 'w-3/4', 'w-1/2'] as const

  return (
    <div className={cn('grid gap-2', className)} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-8', widths[index % widths.length])}
        />
      ))}
      <p className="sr-only">{t('common.loading')}</p>
    </div>
  )
}
