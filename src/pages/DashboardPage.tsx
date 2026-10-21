import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  PlusCircle,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { fetchDashboard } from '@/api/dashboard'
import { isApiError } from '@/api/errors'
import type { DashboardActivity, DashboardSnapshot } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { CategoryShareChart } from '@/components/charts/CategoryShareChart'
import { MoneyBarChart } from '@/components/charts/MoneyBarChart'
import { SpendingPaceChart } from '@/components/charts/SpendingPaceChart'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toBeneficiaryBarPoints, toIncomeExpensePoints } from '@/lib/chart-data'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

function activityLabel(
  activity: DashboardActivity,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  if (activity.kind === 'TRANSFER') {
    const from = activity.sourceAccount?.name ?? '—'
    const to = activity.destinationAccount?.name ?? '—'
    return t('dashboard.activity.transferBetween', { from, to })
  }
  if (activity.account?.name) {
    return activity.account.name
  }
  if (activity.note?.trim()) {
    return activity.note.trim()
  }
  return t(`dashboard.activity.kinds.${activity.kind}`, {
    defaultValue: activity.kind,
  })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user, household } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadGeneration = useRef(0)

  const load = useCallback(async () => {
    if (!household) {
      setDashboard(null)
      setLoading(false)
      setError(t('dashboard.loadError'))
      return
    }

    const requestId = ++loadGeneration.current
    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchDashboard(household.id)
      if (requestId !== loadGeneration.current) {
        return
      }
      setDashboard(snapshot)
    } catch (err) {
      if (requestId !== loadGeneration.current) {
        return
      }
      setDashboard(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else if (isApiError(err)) {
        setError(t('dashboard.loadError'))
      } else {
        setError(t('dashboard.loadError'))
      }
    } finally {
      if (requestId === loadGeneration.current) {
        setLoading(false)
      }
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const currency = dashboard?.currency ?? household?.currency ?? ''

  return (
    <section className="grid min-w-0 gap-4">
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
          {dashboard ? (
            <p className="text-xs text-muted-foreground">
              {t('dashboard.periodRange', {
                from: dashboard.period.from,
                to: dashboard.period.to,
              })}
              {' · '}
              {t('dashboard.asOf', { date: dashboard.asOf })}
            </p>
          ) : null}
        </div>
        <Link to="/expenses" className={cn(buttonVariants())}>
          <PlusCircle data-icon="inline-start" />
          {t('dashboard.quickAdd')}
        </Link>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('dashboard.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          loading={loading}
          label={t('dashboard.totalBalance')}
          value={
            dashboard
              ? formatMoney(dashboard.totalBalance, currency)
              : undefined
          }
          icon={<Wallet className="size-4" aria-hidden />}
        />
        <SummaryMetric
          loading={loading}
          label={t('dashboard.expense')}
          value={
            dashboard
              ? formatMoney(dashboard.overview.expense, currency)
              : undefined
          }
          icon={<ArrowDownRight className="size-4" aria-hidden />}
        />
        <SummaryMetric
          loading={loading}
          label={t('dashboard.income')}
          value={
            dashboard
              ? formatMoney(dashboard.overview.income, currency)
              : undefined
          }
          icon={<ArrowUpRight className="size-4" aria-hidden />}
        />
        <SummaryMetric
          loading={loading}
          label={t('dashboard.net')}
          value={
            dashboard ? formatMoney(dashboard.overview.net, currency) : undefined
          }
          hint={
            dashboard?.overview.elapsedDayAverage
              ? t('dashboard.elapsedAverage', {
                  amount: formatMoney(
                    dashboard.overview.elapsedDayAverage,
                    currency,
                  ),
                })
              : undefined
          }
        />
      </div>

      <Card className="min-w-0 overflow-visible">
        <CardHeader>
          <CardTitle>{t('dashboard.spendingPace')}</CardTitle>
          <CardDescription>{t('dashboard.spendingPaceHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : dashboard ? (
            <SpendingPaceChart
              points={dashboard.spendingPace}
              comparisonComplete={dashboard.comparisonPeriod.coverage.complete}
              currency={currency}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle>{t('dashboard.categoryBreakdown')}</CardTitle>
            <CardDescription>
              {t('dashboard.categoryBreakdownHint')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : dashboard ? (
              <CategoryShareChart
                rows={dashboard.categoryBreakdown}
                currency={currency}
                title={t('dashboard.categoryBreakdown')}
                emptyLabel={t('dashboard.categoryBreakdownEmpty')}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle>{t('dashboard.incomeExpense')}</CardTitle>
            <CardDescription>{t('dashboard.incomeExpenseHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : dashboard ? (
              <MoneyBarChart
                items={toIncomeExpensePoints(dashboard.overview, currency, {
                  income: t('dashboard.income'),
                  expense: t('dashboard.expense'),
                })}
                currency={currency}
                title={t('dashboard.incomeExpense')}
                emptyLabel={t('dashboard.incomeExpenseEmpty')}
                layout="horizontal"
                chartName="income-expense"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden />
              {t('dashboard.beneficiarySpending')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.beneficiarySpendingHint')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageLoading />
          </CardContent>
        </Card>
      ) : dashboard && dashboard.beneficiarySpending.length > 0 ? (
        <Card className="min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden />
              {t('dashboard.beneficiarySpending')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.beneficiarySpendingHint')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MoneyBarChart
              items={toBeneficiaryBarPoints(
                dashboard.beneficiarySpending,
                currency,
              )}
              currency={currency}
              title={t('dashboard.beneficiarySpending')}
              emptyLabel={t('dashboard.beneficiarySpendingEmpty')}
              chartName="beneficiary-spending"
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" aria-hidden />
                {t('dashboard.balances')}
              </CardTitle>
              <CardDescription>
                {household
                  ? `${household.name} · ${currency || household.currency}`
                  : t('dashboard.subtitle')}
              </CardDescription>
            </div>
            <Link
              to="/accounts"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('dashboard.accountsPreview')}
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : dashboard && dashboard.accounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounts.name')}</TableHead>
                    <TableHead className="text-right">
                      {t('accounts.balance')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.name}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-medium',
                          account.negativeBalanceWarning && 'text-destructive',
                        )}
                      >
                        {formatMoney(account.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <PageEmptyState
                icon={Wallet}
                message={t('dashboard.balancesEmpty')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" aria-hidden />
              {t('dashboard.recentActivity')}
            </CardTitle>
            <CardDescription>{t('dashboard.recentActivityHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : dashboard && dashboard.recentActivity.length > 0 ? (
              <ul className="grid gap-3">
                {dashboard.recentActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActivityKindBadge kind={activity.kind} />
                        <span className="truncate text-sm font-medium">
                          {activityLabel(activity, t)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activity.effectiveDate}
                        {activity.note?.trim() && activity.kind !== 'TRANSFER'
                          ? ` · ${activity.note.trim()}`
                          : null}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 text-sm font-medium',
                        activity.kind === 'EXPENSE' && 'text-destructive',
                        activity.kind === 'INCOME' && 'text-foreground',
                      )}
                    >
                      {formatMoney(activity.amount, activity.currency || currency)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <PageEmptyState
                icon={Receipt}
                message={t('dashboard.activityEmpty')}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function SummaryMetric({
  loading,
  label,
  value,
  hint,
  icon,
}: {
  loading: boolean
  label: string
  value?: string
  hint?: string
  icon?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">
          {loading ? <Skeleton className="h-7 w-28" /> : (value ?? '—')}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function ActivityKindBadge({ kind }: { kind: string }) {
  const { t } = useTranslation()
  const label = t(`dashboard.activity.kinds.${kind}`, { defaultValue: kind })
  const icon =
    kind === 'INCOME' ? (
      <ArrowUpRight className="size-3" aria-hidden />
    ) : kind === 'TRANSFER' ? (
      <ArrowLeftRight className="size-3" aria-hidden />
    ) : (
      <ArrowDownRight className="size-3" aria-hidden />
    )

  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      {icon}
      {label}
    </Badge>
  )
}
