import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BanknoteArrowUp, Eye, Filter, PlusCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { listAccounts } from '@/api/accounts'
import { listBeneficiaries, type Beneficiary } from '@/api/beneficiaries'
import {
  createIncome,
  getIncome,
  listIncomes,
  voidIncome,
  type Income,
} from '@/api/incomes'
import type { Account } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { AccountLabel } from '@/components/accounts/AccountIcon'
import {
  IncomeForm,
  type IncomeFormValues,
} from '@/components/incomes/IncomeForm'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { incomeErrorKey } from '@/lib/income-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type FormMode = 'create' | 'detail'

type PendingVoid = {
  id: string
  reason: string
  version: number
}

export function IncomesPage() {
  const { t } = useTranslation()
  const { household } = useAuth()

  const [incomes, setIncomes] = useState<Income[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [selected, setSelected] = useState<Income | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [writeSucceeded, setWriteSucceeded] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailLoadFailed, setDetailLoadFailed] = useState(false)

  const loadSeq = useRef(0)
  const detailSeq = useRef(0)
  const selectedIdRef = useRef<string | null>(null)
  const pendingVoidRef = useRef<PendingVoid | null>(null)
  const pendingToastRef = useRef<string | null>(null)

  const formLocked = submitting || writeSucceeded

  const load = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      const seq = ++loadSeq.current
      if (!household) {
        if (seq !== loadSeq.current) {
          return false
        }
        setIncomes([])
        setAccounts([])
        setBeneficiaries([])
        setLoading(false)
        setError(t('incomes.loadError'))
        return false
      }

      if (!options?.silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const [rows, accountRows, beneficiaryRows] = await Promise.all([
          listIncomes(household.id),
          listAccounts(household.id),
          listBeneficiaries(household.id, 'ACTIVE'),
        ])
        if (seq !== loadSeq.current) {
          return false
        }
        setIncomes(rows)
        setAccounts(accountRows.filter((row) => row.status === 'ACTIVE'))
        setBeneficiaries(
          beneficiaryRows.filter((row) => row.status === 'ACTIVE'),
        )
        setError(null)
        return true
      } catch (err) {
        if (seq !== loadSeq.current) {
          return false
        }
        if (!options?.silent) {
          setIncomes(null)
          setError(t(incomeErrorKey(err)))
        }
        return false
      } finally {
        if (seq === loadSeq.current && !options?.silent) {
          setLoading(false)
        }
      }
    },
    [household, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const loadDetail = useCallback(
    async (incomeId: string) => {
      if (!household) {
        setFormError(t('incomes.loadError'))
        return null
      }
      const seq = ++detailSeq.current
      setDetailLoading(true)
      setDetailLoadFailed(false)
      setFormError(null)
      try {
        const detail = await getIncome(household.id, incomeId)
        if (
          seq !== detailSeq.current ||
          selectedIdRef.current !== incomeId ||
          detail.id !== incomeId
        ) {
          return null
        }
        setSelected(detail)
        return detail
      } catch {
        if (seq !== detailSeq.current || selectedIdRef.current !== incomeId) {
          return null
        }
        setDetailLoadFailed(true)
        setFormError(t('incomes.detailLoadError'))
        return null
      } finally {
        if (seq === detailSeq.current) {
          setDetailLoading(false)
        }
      }
    },
    [household, t],
  )

  const filtered = useMemo(() => {
    if (!incomes) {
      return []
    }
    const needle = query.trim().toLowerCase()
    return incomes.filter((income) => {
      if (accountFilter !== 'all' && income.account.id !== accountFilter) {
        return false
      }
      if (
        beneficiaryFilter !== 'all' &&
        income.beneficiary.id !== beneficiaryFilter
      ) {
        return false
      }
      if (fromDate && income.effectiveDate < fromDate) {
        return false
      }
      if (toDate && income.effectiveDate > toDate) {
        return false
      }
      if (!needle) {
        return true
      }
      const haystack = [
        income.note ?? '',
        income.account.name,
        income.beneficiary.name,
        income.amount,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [incomes, query, accountFilter, beneficiaryFilter, fromDate, toDate])

  function finishSuccessfulWrite() {
    const toastKey = pendingToastRef.current
    pendingToastRef.current = null
    setWriteSucceeded(false)
    setFormOpen(false)
    setSelected(null)
    selectedIdRef.current = null
    setFormError(null)
    setDetailLoading(false)
    setDetailLoadFailed(false)
    if (toastKey) {
      toast.success(t(toastKey))
    }
  }

  function openCreate() {
    if (formLocked) {
      return
    }
    detailSeq.current += 1
    selectedIdRef.current = null
    setFormMode('create')
    setSelected(null)
    setFormError(null)
    setDetailLoading(false)
    setDetailLoadFailed(false)
    setFormOpen(true)
  }

  function openDetail(income: Income) {
    if (formLocked) {
      return
    }
    setFormMode('detail')
    setSelected(income)
    selectedIdRef.current = income.id
    setFormError(null)
    setDetailLoadFailed(false)
    setFormOpen(true)
    void loadDetail(income.id)
  }

  function closeForm() {
    if (formLocked) {
      return
    }
    detailSeq.current += 1
    selectedIdRef.current = null
    setFormOpen(false)
    setSelected(null)
    setFormError(null)
    setDetailLoading(false)
    setDetailLoadFailed(false)
  }

  function handleFormOpenChange(
    open: boolean,
    details?: { cancel: () => void },
  ) {
    if (open) {
      setFormOpen(true)
      return
    }
    if (formLocked) {
      details?.cancel()
      return
    }
    closeForm()
  }

  async function refreshAfterWrite(): Promise<boolean> {
    const refreshed = await load({ silent: true })
    if (refreshed) {
      finishSuccessfulWrite()
      return true
    }
    setFormError(t('incomes.refreshError'))
    return false
  }

  async function handleSubmit(values: IncomeFormValues) {
    if (!household || formLocked) {
      if (!household) {
        setFormError(t('incomes.loadError'))
      }
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createIncome(household.id, {
        effectiveDate: values.effectiveDate,
        amount: values.amount,
        accountId: values.accountId,
        beneficiaryId: values.beneficiaryId,
        note: values.note || undefined,
      })
      pendingToastRef.current = 'common.toast.created'
      setWriteSucceeded(true)
      await refreshAfterWrite()
    } catch (err) {
      setFormError(t(incomeErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVoid(reason: string) {
    if (!household || !selectedIdRef.current || formLocked) {
      if (!household || !selectedIdRef.current) {
        setFormError(t('incomes.loadError'))
      }
      return
    }

    const incomeId = selectedIdRef.current
    setSubmitting(true)
    setFormError(null)
    try {
      let version: number
      const pending = pendingVoidRef.current
      if (pending && pending.id === incomeId && pending.reason === reason) {
        version = pending.version
      } else {
        const seq = ++detailSeq.current
        const detail = await getIncome(household.id, incomeId)
        if (
          seq !== detailSeq.current ||
          selectedIdRef.current !== incomeId ||
          detail.id !== incomeId
        ) {
          return
        }
        setSelected(detail)
        if (!detail.capabilities.canVoid) {
          setFormError(t('incomes.errors.forbidden'))
          return
        }
        version = detail.version
        pendingVoidRef.current = { id: incomeId, reason, version }
      }

      await voidIncome(household.id, incomeId, version, { reason })
      pendingVoidRef.current = null
      pendingToastRef.current = 'common.toast.voided'
      setWriteSucceeded(true)
      detailSeq.current += 1
      await refreshAfterWrite()
    } catch (err) {
      setFormError(t(incomeErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetry() {
    if (writeSucceeded) {
      if (submitting) {
        return
      }
      setSubmitting(true)
      try {
        await refreshAfterWrite()
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (formMode === 'detail' && selectedIdRef.current) {
      void loadDetail(selectedIdRef.current)
    }
  }

  const currency = household?.currency ?? 'MMK'
  const canCreate = accounts.length > 0 && beneficiaries.length > 0
  const retryHandler =
    writeSucceeded || detailLoadFailed ? handleRetry : undefined

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('incomes.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('incomes.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate} disabled={!canCreate || loading}>
          <PlusCircle data-icon="inline-start" />
          {t('incomes.add')}
        </Button>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('incomes.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4" aria-hidden />
            {t('incomes.filters.title')}
          </CardTitle>
          <CardDescription>{t('incomes.filters.hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="income-search">{t('incomes.filters.search')}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="income-search"
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('incomes.filters.searchPlaceholder')}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-account">{t('incomes.fields.account')}</Label>
            <select
              id="filter-account"
              className={selectClassName}
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="all">{t('incomes.filters.allAccounts')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-beneficiary">
              {t('incomes.fields.beneficiary')}
            </Label>
            <select
              id="filter-beneficiary"
              className={selectClassName}
              value={beneficiaryFilter}
              onChange={(event) => setBeneficiaryFilter(event.target.value)}
            >
              <option value="all">
                {t('incomes.filters.allBeneficiaries')}
              </option>
              {beneficiaries.map((beneficiary) => (
                <option key={beneficiary.id} value={beneficiary.id}>
                  {beneficiary.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-1 md:col-span-2">
            <div className="grid gap-2">
              <Label htmlFor="filter-from">{t('incomes.filters.from')}</Label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-to">{t('incomes.filters.to')}</Label>
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
            <BanknoteArrowUp className="size-4" aria-hidden />
            {t('incomes.title')}
          </CardTitle>
          <CardDescription>
            {household
              ? `${household.name} · ${currency}`
              : t('incomes.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('incomes.fields.date')}</TableHead>
                  <TableHead>{t('incomes.fields.amount')}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('incomes.fields.account')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('incomes.fields.beneficiary')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('incomes.fields.note')}
                  </TableHead>
                  <TableHead className="w-[1%] text-right">
                    {t('incomes.fields.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>{income.effectiveDate}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatMoney(income.amount, income.currency)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <AccountLabel name={income.account.name} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {income.beneficiary.name}
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">
                      {income.note || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetail(income)}
                      >
                        <Eye data-icon="inline-start" />
                        {income.capabilities.canVoid
                          ? t('incomes.view')
                          : t('incomes.readOnly')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={BanknoteArrowUp}
              message={
                incomes && incomes.length > 0
                  ? t('incomes.filters.none')
                  : t('incomes.empty')
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        disablePointerDismissal={formLocked}
        onOpenChange={handleFormOpenChange}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!formLocked}
        >
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create'
                ? t('incomes.form.createTitle')
                : t('incomes.form.detailTitle')}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? t('incomes.form.createHint')
                : t('incomes.form.detailHint')}
            </DialogDescription>
          </DialogHeader>
          <IncomeForm
            key={
              formMode === 'detail' && selected
                ? `detail-${selected.id}`
                : `create-${accounts.length}-${beneficiaries.length}`
            }
            mode={formMode}
            income={selected}
            accounts={accounts}
            beneficiaries={beneficiaries}
            currency={currency}
            timeZone={household?.timezone ?? 'UTC'}
            submitting={submitting}
            locked={writeSucceeded}
            detailLoading={detailLoading}
            error={formError}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            onRetry={retryHandler}
            onVoid={formMode === 'detail' ? handleVoid : undefined}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
