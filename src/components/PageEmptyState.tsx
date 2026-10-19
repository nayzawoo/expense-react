import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'

type PageEmptyStateProps = {
  message: string
  icon?: LucideIcon
  className?: string
}

/** Shared empty-list placeholder with a Lucide icon. */
export function PageEmptyState({
  message,
  icon: Icon = Inbox,
  className,
}: PageEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 py-2 text-sm text-muted-foreground',
        className,
      )}
      role="status"
    >
      <Icon className="size-5 shrink-0 opacity-70" aria-hidden />
      <p>{message}</p>
    </div>
  )
}
