import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Eye, Filter, PlusCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { listAccounts } from '@/api/accounts'
import {
  createTransfer,
  listTransfers,
  voidTransfer,
  type Transfer,
} from '@/api/transfers'
import type { Account } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { AccountLabel } from '@/components/accounts/AccountIcon'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import {
  TransferForm,
  type TransferFormValues,
} from '@/components/transfers/TransferForm'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { transferErrorKey } from '@/lib/transfer-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type FormMode = 'create' | 'detail'

export function TransfersPage() {
  const { t } = useTranslation()
  const { household } = useAuth()

  const [transfers, setTransfers] = useState<Transfer[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [destinationFilter, setDestinationFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [selected, setSelected] = useState<Transfer | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!household) {
      setTransfers([])
      setAccounts([])
      setLoading(false)
      setError(t('transfers.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [rows, accountRows] = await Promise.all([
        listTransfers(household.id),
        listAccounts(household.id),
      ])
      setTransfers(rows)
      setAccounts(accountRows.filter((row) => row.status === 'ACTIVE'))
    } catch (err) {
      setTransfers(null)
      setError(t(transferErrorKey(err)))
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!transfers) {
      return []
    }
    const needle = query.trim().toLowerCase()
    return transfers.filter((transfer) => {
      if (
        sourceFilter !== 'all' &&
        transfer.sourceAccount.id !== sourceFilter
      ) {
        return false
      }
      if (
        destinationFilter !== 'all' &&
        transfer.destinationAccount.id !== destinationFilter
      ) {
        return false
      }
      if (fromDate && transfer.effectiveDate < fromDate) {
        return false
      }
      if (toDate && transfer.effectiveDate > toDate) {
        return false
      }
      if (!needle) {
        return true
      }
      const haystack = [
        transfer.note ?? '',
        transfer.sourceAccount.name,
        transfer.destinationAccount.name,
        transfer.amount,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [transfers, query, sourceFilter, destinationFilter, fromDate, toDate])

  function openCreate() {
    setFormMode('create')
    setSelected(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openDetail(transfer: Transfer) {
    setFormMode('detail')
    setSelected(transfer)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    if (submitting) {
      return
    }
    setFormOpen(false)
    setSelected(null)
    setFormError(null)
  }

  function handleFormOpenChange(
    open: boolean,
    details?: { cancel: () => void },
  ) {
    if (open) {
      setFormOpen(true)
      return
    }
    if (submitting) {
      details?.cancel()
      return
    }
    closeForm()
  }

  async function handleSubmit(values: TransferFormValues) {
    if (!household) {
      setFormError(t('transfers.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createTransfer(household.id, {
        effectiveDate: values.effectiveDate,
        amount: values.amount,
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: values.destinationAccountId,
        note: values.note || undefined,
      })
      toast.success(t('common.toast.created'))
      setFormOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(transferErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVoid(reason: string) {
    if (!household || !selected) {
      setFormError(t('transfers.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await voidTransfer(household.id, selected.id, selected.version, {
        reason,
      })
      toast.success(t('common.toast.voided'))
      setFormOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(transferErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  const currency = household?.currency ?? 'MMK'
  const canCreate = accounts.length >= 2

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('transfers.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('transfers.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate} disabled={!canCreate || loading}>
          <PlusCircle data-icon="inline-start" />
          {t('transfers.add')}
        </Button>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('transfers.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4" aria-hidden />
            {t('transfers.filters.title')}
          </CardTitle>
          <CardDescription>{t('transfers.filters.hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="transfer-search">
              {t('transfers.filters.search')}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="transfer-search"
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('transfers.filters.searchPlaceholder')}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-source">
              {t('transfers.fields.sourceAccount')}
            </Label>
            <select
              id="filter-source"
              className={selectClassName}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="all">{t('transfers.filters.allAccounts')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-destination">
              {t('transfers.fields.destinationAccount')}
            </Label>
            <select
              id="filter-destination"
              className={selectClassName}
              value={destinationFilter}
              onChange={(event) => setDestinationFilter(event.target.value)}
            >
              <option value="all">{t('transfers.filters.allAccounts')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-1 md:col-span-2">
            <div className="grid gap-2">
              <Label htmlFor="filter-from">{t('transfers.filters.from')}</Label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-to">{t('transfers.filters.to')}</Label>
              <Input
                id="filter-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4" aria-hidden />
            {t('transfers.title')}
          </CardTitle>
          <CardDescription>
            {household
              ? `${household.name} · ${currency}`
              : t('transfers.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('transfers.fields.date')}</TableHead>
                  <TableHead>{t('transfers.fields.amount')}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('transfers.fields.sourceAccount')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('transfers.fields.destinationAccount')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('transfers.fields.note')}
                  </TableHead>
                  <TableHead className="w-[1%] text-right">
                    {t('transfers.fields.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>{transfer.effectiveDate}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatMoney(transfer.amount, transfer.currency)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <AccountLabel name={transfer.sourceAccount.name} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AccountLabel name={transfer.destinationAccount.name} />
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">
                      {transfer.note || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {transfer.capabilities.canVoid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(transfer)}
                        >
                          <Eye data-icon="inline-start" />
                          {t('transfers.view')}
                        </Button>
                      ) : (
                        <Badge variant="secondary">
                          {t('transfers.readOnly')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={ArrowRightLeft}
              message={
                transfers && transfers.length > 0
                  ? t('transfers.filters.none')
                  : t('transfers.empty')
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        disablePointerDismissal={submitting}
        onOpenChange={handleFormOpenChange}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!submitting}
        >
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create'
                ? t('transfers.form.createTitle')
                : t('transfers.form.detailTitle')}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? t('transfers.form.createHint')
                : t('transfers.form.detailHint')}
            </DialogDescription>
          </DialogHeader>
          <TransferForm
            key={
              formMode === 'detail' && selected
                ? `detail-${selected.id}-${selected.version}`
                : `create-${accounts.length}`
            }
            mode={formMode}
            transfer={selected}
            accounts={accounts}
            currency={currency}
            timeZone={household?.timezone ?? 'UTC'}
            submitting={submitting}
            error={formError}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            onVoid={
              formMode === 'detail' && selected?.capabilities.canVoid
                ? handleVoid
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
