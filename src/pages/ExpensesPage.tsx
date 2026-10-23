import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, Pencil, PlusCircle, Receipt, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { listAccounts } from '@/api/accounts'
import { listBeneficiaries, type Beneficiary } from '@/api/beneficiaries'
import { listCategories, type Category } from '@/api/categories'
import {
  createExpense,
  listExpenses,
  replaceExpense,
  voidExpense,
  type Expense,
} from '@/api/expenses'
import type { Account } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { AccountLabel } from '@/components/accounts/AccountIcon'
import {
  ExpenseForm,
  type ExpenseFormValues,
} from '@/components/expenses/ExpenseForm'
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
import { expenseErrorKey } from '@/lib/expense-errors'
import { CategoryIconView } from '@/lib/category-icons'
import { formatExpenseDate, groupExpensesByDate } from '@/lib/expense-groups'
import { householdToday } from '@/lib/household-date'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type FormMode = 'create' | 'edit'

export function ExpensesPage() {
  const { t } = useTranslation()
  const { household } = useAuth()

  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [selected, setSelected] = useState<Expense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!household) {
      setExpenses([])
      setAccounts([])
      setCategories([])
      setBeneficiaries([])
      setLoading(false)
      setError(t('expenses.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [rows, accountRows, categoryRows, beneficiaryRows] =
        await Promise.all([
          listExpenses(household.id),
          listAccounts(household.id),
          listCategories(household.id, 'ALL'),
          listBeneficiaries(household.id, 'ACTIVE'),
        ])
      setExpenses(rows)
      setAccounts(accountRows)
      setCategories(categoryRows)
      setBeneficiaries(beneficiaryRows)
    } catch (err) {
      setExpenses(null)
      setError(t(expenseErrorKey(err)))
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === 'ACTIVE'),
    [accounts],
  )

  const filtered = useMemo(() => {
    if (!expenses) {
      return []
    }
    const needle = query.trim().toLowerCase()
    return expenses.filter((expense) => {
      if (accountFilter !== 'all' && expense.account.id !== accountFilter) {
        return false
      }
      if (categoryFilter !== 'all' && expense.category.id !== categoryFilter) {
        return false
      }
      if (fromDate && expense.effectiveDate < fromDate) {
        return false
      }
      if (toDate && expense.effectiveDate > toDate) {
        return false
      }
      if (!needle) {
        return true
      }
      const haystack = [
        expense.note ?? '',
        expense.account.name,
        accountById.get(expense.account.id)?.ownerLabel ?? '',
        expense.category.name,
        expense.beneficiary.name,
        expense.amount,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [expenses, query, accountFilter, categoryFilter, fromDate, toDate, accountById])

  const dateGroups = useMemo(() => groupExpensesByDate(filtered), [filtered])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const activeCategories = useMemo(
    () => categories.filter((category) => category.status === 'ACTIVE'),
    [categories],
  )
  const today = householdToday(household?.timezone || 'Asia/Yangon')

  function openCreate() {
    setFormMode('create')
    setSelected(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(expense: Expense) {
    if (!expense.capabilities.canReplace && !expense.capabilities.canVoid) {
      return
    }
    setFormMode('edit')
    setSelected(expense)
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

  async function handleSubmit(values: ExpenseFormValues) {
    if (!household) {
      setFormError(t('expenses.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (formMode === 'create') {
        await createExpense(household.id, {
          effectiveDate: values.effectiveDate,
          amount: values.amount,
          accountId: values.accountId,
          categoryId: values.categoryId,
          beneficiaryId: values.beneficiaryId,
          note: values.note || undefined,
        })
        toast.success(t('common.toast.created'))
      } else if (selected) {
        await replaceExpense(
          household.id,
          selected.id,
          selected.version,
          {
            effectiveDate: values.effectiveDate,
            amount: values.amount,
            accountId: values.accountId,
            categoryId: values.categoryId,
            beneficiaryId: values.beneficiaryId,
            note: values.note || undefined,
            changeReason: values.changeReason,
          },
        )
        toast.success(t('common.toast.updated'))
      }
      setFormOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(expenseErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVoid(reason: string) {
    if (!household || !selected) {
      setFormError(t('expenses.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await voidExpense(household.id, selected.id, selected.version, {
        reason,
      })
      toast.success(t('common.toast.voided'))
      setFormOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(expenseErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  const currency = household?.currency ?? 'MMK'
  const canMutate =
    activeAccounts.length > 0 && activeCategories.length > 0 && beneficiaries.length > 0

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('expenses.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('expenses.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate} disabled={!canMutate || loading}>
          <PlusCircle data-icon="inline-start" />
          {t('expenses.add')}
        </Button>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('expenses.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4" aria-hidden />
            {t('expenses.filters.title')}
          </CardTitle>
          <CardDescription>{t('expenses.filters.hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="expense-search">{t('expenses.filters.search')}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="expense-search"
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('expenses.filters.searchPlaceholder')}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-account">{t('expenses.fields.account')}</Label>
            <select
              id="filter-account"
              className={selectClassName}
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="all">{t('expenses.filters.allAccounts')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.ownerLabel})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-category">
              {t('expenses.fields.category')}
            </Label>
            <select
              id="filter-category"
              className={selectClassName}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">{t('expenses.filters.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-1 md:col-span-2">
            <div className="grid gap-2">
              <Label htmlFor="filter-from">{t('expenses.filters.from')}</Label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-to">{t('expenses.filters.to')}</Label>
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
            <Receipt className="size-4" aria-hidden />
            {t('expenses.title')}
          </CardTitle>
          <CardDescription>
            {household
              ? `${household.name} · ${currency}`
              : t('expenses.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : filtered.length > 0 ? (
            <Table className="block lg:table">
              <TableHeader className="hidden lg:table-header-group">
                <TableRow>
                  <TableHead>{t('expenses.fields.date')}</TableHead>
                  <TableHead>{t('expenses.fields.amount')}</TableHead>
                  <TableHead>
                    {t('expenses.fields.account')}
                  </TableHead>
                  <TableHead>
                    {t('expenses.fields.category')}
                  </TableHead>
                  <TableHead>
                    {t('expenses.fields.beneficiary')}
                  </TableHead>
                  <TableHead>
                    {t('expenses.fields.note')}
                  </TableHead>
                  <TableHead>{t('expenses.fields.recordedBy')}</TableHead>
                  <TableHead className="w-[1%] text-right">
                    {t('expenses.fields.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="block [&_tr:last-child]:border lg:table-row-group lg:[&_tr:last-child]:border-0">
                {dateGroups.map(([date, rows]) => (
                  <Fragment key={date}>
                    <TableRow className="block border-0 hover:bg-transparent lg:table-row">
                      <TableCell colSpan={8} className="block px-0 pt-5 pb-3 whitespace-normal lg:table-cell lg:px-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="text-base font-semibold tracking-tight">
                              {date === today ? t('expenses.groups.today') : <time dateTime={date}>{formatExpenseDate(date)}</time>}
                            </h3>
                            {date === today ? (
                              <time dateTime={date} className="text-xs text-muted-foreground">{formatExpenseDate(date)}</time>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {t('expenses.groups.count', { count: rows.length })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {rows.map((expense) => {
                      const account = accountById.get(expense.account.id)
                      const category = categoryById.get(expense.category.id)
                      const canOpen =
                        expense.capabilities.canReplace ||
                        expense.capabilities.canVoid
                      return (
                        <TableRow key={expense.id} className="mb-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 hover:bg-muted/20 lg:mb-0 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:p-0">
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell"><time dateTime={expense.effectiveDate}>{expense.effectiveDate}</time></TableCell>
                          <TableCell className="col-span-2 min-w-0 p-0 text-xl font-semibold break-words whitespace-normal text-rose-700 tabular-nums lg:p-2 lg:text-sm lg:whitespace-nowrap dark:text-rose-400">
                            <span className="mb-1 block text-xs font-normal text-muted-foreground lg:sr-only">{t('expenses.fields.amount')}</span>
                            {formatMoney(expense.amount, expense.currency)}
                          </TableCell>
                          <TableCell className="min-w-0 p-0 whitespace-normal lg:p-2">
                            <span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t('expenses.fields.account')}</span>
                            <AccountLabel name={expense.account.name} type={account?.type} ownerLabel={account?.ownerLabel} />
                          </TableCell>
                          <TableCell className="min-w-0 p-0 whitespace-normal lg:p-2">
                            <span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t('expenses.fields.category')}</span>
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                                style={category ? { backgroundColor: `${category.color}18` } : undefined}
                              >
                                <CategoryIconView
                                  iconKey={category?.iconKey ?? 'other'}
                                  className="size-4"
                                  style={category ? { color: category.color } : undefined}
                                />
                              </span>
                              <span className="min-w-0 font-medium break-words">{expense.category.name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="min-w-0 p-0 whitespace-normal lg:p-2">
                            <span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t('expenses.fields.beneficiary')}</span>
                            <span className="inline-block max-w-full rounded-md bg-blue-50 px-2 py-1 text-xs font-medium break-words text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">{expense.beneficiary.name}</span>
                          </TableCell>
                          <TableCell className="order-1 col-span-2 min-w-0 p-0 whitespace-normal lg:order-none lg:max-w-64 lg:p-2">
                            <span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t('expenses.fields.note')}</span>
                            <span className="text-sm whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{expense.note || '—'}</span>
                          </TableCell>
                          <TableCell className="min-w-0 p-0 whitespace-normal lg:p-2">
                            <span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t('expenses.fields.recordedBy')}</span>
                            <span className="text-xs break-words text-muted-foreground">{expense.createdBy.displayName}</span>
                          </TableCell>
                          <TableCell className="order-2 col-span-2 border-t pt-3 pr-0 pb-0 pl-0 text-right lg:order-none lg:border-0 lg:p-2">
                            {canOpen ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(expense)}
                              >
                                <Pencil data-icon="inline-start" />
                                {t('expenses.edit')}
                              </Button>
                            ) : (
                              <Badge variant="secondary">
                                {t('expenses.readOnly')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={Receipt}
              message={
                expenses && expenses.length > 0
                  ? t('expenses.filters.none')
                  : t('expenses.empty')
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
                ? t('expenses.form.createTitle')
                : t('expenses.form.editTitle')}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? t('expenses.form.createHint')
                : t('expenses.form.editHint')}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            key={
              formMode === 'edit' && selected
                ? `edit-${selected.id}-${selected.version}`
                : `create-${activeAccounts.length}-${activeCategories.length}-${beneficiaries.length}`
            }
            mode={formMode}
            expense={selected}
            accounts={activeAccounts}
            categories={activeCategories}
            beneficiaries={beneficiaries}
            currency={currency}
            timeZone={household?.timezone ?? 'UTC'}
            submitting={submitting}
            error={formError}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            onVoid={
              formMode === 'edit' && selected?.capabilities.canVoid
                ? handleVoid
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
