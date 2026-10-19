import { Link } from 'react-router-dom'
import { PlusCircle, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Link to="/expenses" className={cn(buttonVariants())}>
          <PlusCircle data-icon="inline-start" />
          {t('dashboard.quickAdd')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            {t('dashboard.title')}
          </CardTitle>
          <CardDescription>{t('dashboard.placeholder')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('common.comingSoon')}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
