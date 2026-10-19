import { Link } from 'react-router-dom'
import { PlusCircle, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
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
  const { user, household } = useAuth()

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? t('dashboard.greeting', { name: user.displayName })
              : t('dashboard.subtitle')}
          </p>
        </div>
        <Link to="/expenses" className={cn(buttonVariants())}>
          <PlusCircle data-icon="inline-start" />
          {t('dashboard.quickAdd')}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.household')}</CardTitle>
            <CardDescription>{t('dashboard.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {household ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t('dashboard.household')}
                  </span>
                  <span className="font-medium">{household.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t('dashboard.currency')}
                  </span>
                  <span className="font-medium">{household.currency}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t('dashboard.timezone')}
                  </span>
                  <span className="font-medium">{household.timezone}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                {t('dashboard.signedOutHint')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" aria-hidden />
              {t('accounts.title')}
            </CardTitle>
            <CardDescription>{t('accounts.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/accounts"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('dashboard.accountsPreview')}
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
