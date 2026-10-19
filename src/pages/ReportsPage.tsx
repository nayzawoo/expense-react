import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Equal,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/errors'
import { fetchAnalytics } from '@/api/reports'
import type {
  AnalyticsSnapshot,
  CategoryChangeRow,
  MonthTrendPoint,
} from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

function trendMaxExpense(points: MonthTrendPoint[]): number {
  let max = 0
  for (const point of points) {
    if (point.expense == null) {
      continue
    }
    const value = Number(point.expense)
    if (Number.isFinite(value) && value > max) {
      max = value
    }
  }
  return max
}

function coverageLabel(
  complete: boolean,
  reason: string | null,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  if (complete) {
    return t('reports.coverage.complete')
  }
  if (reason === 'ACCOUNT_OPENING_GAP') {
    return t('reports.coverage.accountOpeningGap')
  }
  return t('reports.coverage.incomplete')
}

function changePercentLabel(value: string | null): string {
  if (value == null) {
    return '—'
  }
  return `${value}%`
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { household } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [asOfDraft, setAsOfDraft] = useState('')
  const [asOfApplied, setAsOfApplied] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    if (!household) {
      setAnalytics(null)
      setLoading(false)
      setError(t('reports.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchAnalytics(household.id, asOfApplied)
      setAnalytics(snapshot)
      setAsOfDraft(snapshot.asOf)
    } catch (err) {
      setAnalytics(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else if (isApiError(err) && err.status === 422) {
        setError(t('reports.invalidAsOf'))
      } else {
        setError(t('reports.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [asOfApplied, household, t])

  useEffect(() => {
    void load()
  }, [load])

  const currency = analytics?.currency ?? household?.currency ?? ''
  const maxTrend = useMemo(
    () => (analytics ? trendMaxExpense(analytics.monthlyTrend) : 0),
    [analytics],
  )

  function applyAsOf() {
    const next = asOfDraft.trim()
    setAsOfApplied(next.length > 0 ? next : undefined)
  }

  function clearAsOf() {
    setAsOfDraft('')
    setAsOfApplied(undefined)
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('reports.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
          {analytics ? (
            <p className="text-xs text-muted-foreground">
              {t('reports.periodRange', {
                from: analytics.period.from,
                to: analytics.period.to,
              })}
              {' · '}
              {t('reports.asOf', { date: analytics.asOf })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="reports-as-of">{t('reports.asOfLabel')}</Label>
            <Input
              id="reports-as-of"
              type="date"
              value={asOfDraft}
              onChange={(event) => setAsOfDraft(event.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" size="sm" onClick={applyAsOf}>
            {t('reports.applyAsOf')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearAsOf}
            disabled={asOfApplied == null && asOfDraft === ''}
          >
            {t('reports.clearAsOf')}
          </Button>
        </div>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('reports.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          loading={loading}
          label={t('reports.expense')}
          value={
            analytics
              ? formatMoney(analytics.overview.expense, currency)
              : undefined
          }
          icon={<ArrowDownRight className="size-4" aria-hidden />}
        />
        <SummaryMetric
          loading={loading}
          label={t('reports.income')}
          value={
            analytics
              ? formatMoney(analytics.overview.income, currency)
              : undefined
          }
          icon={<ArrowUpRight className="size-4" aria-hidden />}
        />
        <SummaryMetric
          loading={loading}
          label={t('reports.net')}
          value={
            analytics ? formatMoney(analytics.overview.net, currency) : undefined
          }
          hint={
            analytics?.overview.elapsedDayAverage
              ? t('reports.elapsedAverage', {
                  amount: formatMoney(
                    analytics.overview.elapsedDayAverage,
                    currency,
                  ),
                })
              : undefined
          }
        />
        <SummaryMetric
          loading={loading}
          label={t('reports.previousAverage')}
          value={
            analytics?.overview.previousFiveMonthAverage
              ? formatMoney(
                  analytics.overview.previousFiveMonthAverage,
                  currency,
                )
              : analytics
                ? t('reports.notAvailable')
                : undefined
          }
        />
      </div>

      {analytics ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="size-4" aria-hidden />
              {t('reports.periodTitle')}
            </CardTitle>
            <CardDescription>{t('reports.periodHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PeriodBlock
              title={t('reports.currentPeriod')}
              from={analytics.period.from}
              to={analytics.period.to}
              coverage={coverageLabel(
                analytics.period.coverage.complete,
                analytics.period.coverage.reason,
                t,
              )}
            />
            <PeriodBlock
              title={t('reports.comparisonPeriod')}
              from={analytics.comparisonPeriod.from}
              to={analytics.comparisonPeriod.to}
              coverage={coverageLabel(
                analytics.comparisonPeriod.coverage.complete,
                analytics.comparisonPeriod.coverage.reason,
                t,
              )}
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-36 w-full" />
      ) : null}

      <InsightCard loading={loading} analytics={analytics} currency={currency} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4" aria-hidden />
              {t('reports.monthlyTrend')}
            </CardTitle>
            <CardDescription>{t('reports.monthlyTrendHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : analytics && analytics.monthlyTrend.length > 0 ? (
              <ul className="grid gap-3">
                {analytics.monthlyTrend.map((point) => {
                  const amount =
                    point.expense == null ? 0 : Number(point.expense)
                  const width =
                    maxTrend > 0 && Number.isFinite(amount)
                      ? Math.max(4, Math.round((amount / maxTrend) * 100))
                      : 0
                  return (
                    <li key={point.month} className="grid gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{point.month}</span>
                          {point.isPartial ? (
                            <Badge variant="outline">
                              {t('reports.partialMonth')}
                            </Badge>
                          ) : null}
                          <Badge
                            variant={
                              point.coverage === 'COMPLETE'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {t(`reports.monthCoverage.${point.coverage}`, {
                              defaultValue: point.coverage,
                            })}
                          </Badge>
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          {point.expense == null
                            ? t('reports.notAvailable')
                            : formatMoney(point.expense, currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <PageEmptyState
                icon={BarChart3}
                message={t('reports.monthlyTrendEmpty')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-4" aria-hidden />
              {t('reports.categoryBreakdown')}
            </CardTitle>
            <CardDescription>
              {t('reports.categoryBreakdownHint')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoading />
            ) : analytics && analytics.categoryBreakdown.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.fields.category')}</TableHead>
                    <TableHead className="text-right">
                      {t('reports.fields.amount')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('reports.fields.share')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.categoryBreakdown.map((row) => (
                    <TableRow key={row.category.id}>
                      <TableCell className="font-medium">
                        {row.category.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.amount, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.sharePercent}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <PageEmptyState
                icon={PieChart}
                message={t('reports.categoryBreakdownEmpty')}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChangesCard
          loading={loading}
          title={t('reports.increased')}
          hint={t('reports.increasedHint')}
          rows={analytics?.categoryChanges.increased ?? []}
          currency={currency}
          empty={t('reports.changesEmpty')}
          tone="up"
        />
        <CategoryChangesCard
          loading={loading}
          title={t('reports.decreased')}
          hint={t('reports.decreasedHint')}
          rows={analytics?.categoryChanges.decreased ?? []}
          currency={currency}
          empty={t('reports.changesEmpty')}
          tone="down"
        />
      </div>
    </section>
  )
}

function InsightCard({
  loading,
  analytics,
  currency,
}: {
  loading: boolean
  analytics: AnalyticsSnapshot | null
  currency: string
}) {
  const { t } = useTranslation()

  if (loading) {
    return <Skeleton className="h-28 w-full" />
  }

  if (!analytics) {
    return null
  }

  const insight = analytics.insight
  const direction = analytics.overview.direction
  const Icon =
    insight?.kind === 'UP' || direction === 'UP'
      ? ArrowUpRight
      : insight?.kind === 'DOWN' || direction === 'DOWN'
        ? ArrowDownRight
        : Equal

  let body: string
  if (insight == null) {
    body = t('reports.insight.unavailable')
  } else if (insight.kind === 'FLAT') {
    body = t('reports.insight.flat')
  } else if (insight.metric) {
    const contributors =
      insight.contributors.length > 0
        ? insight.contributors.map((item) => item.name).join(', ')
        : t('reports.insight.noContributors')
    body = t(
      insight.kind === 'DOWN'
        ? 'reports.insight.down'
        : 'reports.insight.up',
      {
        amount: formatMoney(insight.metric.expenseDifferenceAbs, currency),
        percent:
          insight.metric.expenseDifferencePercent == null
            ? t('reports.notAvailable')
            : `${insight.metric.expenseDifferencePercent}%`,
        contributors,
      },
    )
  } else {
    body = t('reports.insight.unavailable')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4" aria-hidden />
          {t('reports.insight.title')}
        </CardTitle>
        <CardDescription>{t('reports.insight.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  )
}

function CategoryChangesCard({
  loading,
  title,
  hint,
  rows,
  currency,
  empty,
  tone,
}: {
  loading: boolean
  title: string
  hint: string
  rows: CategoryChangeRow[]
  currency: string
  empty: string
  tone: 'up' | 'down'
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tone === 'up' ? (
            <ArrowUpRight className="size-4" aria-hidden />
          ) : (
            <ArrowDownRight className="size-4" aria-hidden />
          )}
          {title}
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <PageLoading />
        ) : rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.fields.category')}</TableHead>
                <TableHead className="text-right">
                  {t('reports.fields.current')}
                </TableHead>
                <TableHead className="text-right">
                  {t('reports.fields.change')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.category.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.category.name}</span>
                      {row.isNew ? (
                        <Badge variant="outline">{t('reports.newCategory')}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.currentAmount, currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      tone === 'up' ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {formatMoney(row.difference, currency)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({changePercentLabel(row.differencePercent)})
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <PageEmptyState icon={PieChart} message={empty} />
        )}
      </CardContent>
    </Card>
  )
}

function PeriodBlock({
  title,
  from,
  to,
  coverage,
}: {
  title: string
  from: string
  to: string
  coverage: string
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {from} – {to}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{coverage}</p>
    </div>
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
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            {value ?? '—'}
          </p>
        )}
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

