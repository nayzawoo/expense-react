import { useCallback, useEffect, useMemo, useState } from 'react'
import { PlusCircle, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  createAccount,
  listAccounts,
  type Account,
  type AccountStatus,
  type CreateAccountInput,
} from '@/api/accounts'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import {
  AccountForm,
  type AccountFormValues,
} from '@/components/accounts/AccountForm'
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
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type StatusFilter = 'ALL' | AccountStatus

function accountErrorKey(err: unknown): string {
  if (err instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(err)) {
    return 'accounts.errors.generic'
  }

  const detail = (err.code ?? err.message ?? '').trim()
  if (detail === 'FUTURE_DATE') {
    return 'accounts.errors.futureDate'
  }
  if (detail === 'IDEMPOTENCY_KEY_REUSED') {
    return 'accounts.errors.idempotency'
  }

  if (err.status === 403) {
    return 'accounts.errors.forbidden'
  }
  if (err.status === 409) {
    return 'accounts.errors.conflict'
  }
  if (err.status === 404) {
    return 'accounts.errors.notFound'
  }
  if (err.status === 400 || err.status === 422) {
    return 'accounts.errors.invalid'
  }
  return 'accounts.errors.generic'
}

export function AccountsPage() {
  const { t } = useTranslation()
  const { household, user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!household) {
      setAccounts([])
      setLoading(false)
      setError(t('accounts.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Spring list has no status query — filter client-side.
      const rows = await listAccounts(household.id)
      setAccounts(rows)
    } catch (err) {
      setAccounts(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else {
        setError(t('accounts.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const visibleAccounts = useMemo(() => {
    if (!accounts) {
      return null
    }
    if (statusFilter === 'ALL') {
      return accounts
    }
    return accounts.filter((row) => row.status === statusFilter)
  }, [accounts, statusFilter])

  const nextSortOrder = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return 1
    }
    return Math.max(...accounts.map((row) => row.sortOrder)) + 1
  }, [accounts])

  function openCreate() {
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSubmit(values: AccountFormValues | CreateAccountInput) {
    if (!household) {
      setFormError(t('accounts.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createAccount(household.id, values as CreateAccountInput)
      toast.success(t('common.toast.created'))
      setSheetOpen(false)
      await load()
    } catch (err) {
      setFormError(t(accountErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('accounts.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('accounts.subtitle')}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <PlusCircle data-icon="inline-start" />
            {t('accounts.add')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <PageErrorAlert
          title={t('accounts.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" aria-hidden />
                {t('accounts.title')}
              </CardTitle>
              <CardDescription>
                {household
                  ? `${household.name} · ${household.currency}`
                  : t('accounts.subtitle')}
              </CardDescription>
            </div>
            <div className="grid min-w-40 gap-1.5">
              <Label htmlFor="account-status-filter">
                {t('accounts.filterStatus')}
              </Label>
              <select
                id="account-status-filter"
                className={selectClassName}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="ALL">{t('accounts.filters.all')}</option>
                <option value="ACTIVE">{t('accounts.statuses.ACTIVE')}</option>
                <option value="ARCHIVED">
                  {t('accounts.statuses.ARCHIVED')}
                </option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : visibleAccounts && visibleAccounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('accounts.fields.name')}</TableHead>
                  <TableHead>{t('accounts.fields.type')}</TableHead>
                  <TableHead>{t('accounts.fields.owner')}</TableHead>
                  <TableHead>{t('accounts.fields.balance')}</TableHead>
                  <TableHead>{t('accounts.fields.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('accounts.asOf', { date: account.balanceAsOf })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t(`accounts.types.${account.type}`, {
                        defaultValue: account.type,
                      })}
                    </TableCell>
                    <TableCell>{account.ownerLabel}</TableCell>
                    <TableCell
                      className={
                        account.negativeBalanceWarning
                          ? 'font-medium text-destructive'
                          : 'font-medium'
                      }
                    >
                      {formatMoney(account.currentBalance, account.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          account.status === 'ACTIVE' ? 'secondary' : 'outline'
                        }
                      >
                        {t(`accounts.statuses.${account.status}`, {
                          defaultValue: account.status,
                        })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState icon={Wallet} message={t('accounts.empty')} />
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('accounts.form.createTitle')}</SheetTitle>
            <SheetDescription>{t('accounts.form.createHint')}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {household ? (
              <AccountForm
                key={`create-${sheetOpen}`}
                defaultSortOrder={nextSortOrder}
                currency={household.currency}
                timeZone={household.timezone}
                submitting={submitting}
                error={formError}
                onSubmit={handleSubmit}
                onCancel={() => setSheetOpen(false)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
