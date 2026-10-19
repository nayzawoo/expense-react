import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { expenseErrorKey } from '@/lib/expense-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type SheetMode = 'create' | 'edit'

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

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('create')
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
          listCategories(household.id, 'ACTIVE'),
          listBeneficiaries(household.id, 'ACTIVE'),
        ])
      setExpenses(rows)
      setAccounts(accountRows.filter((row) => row.status === 'ACTIVE'))
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
        expense.category.name,
        expense.beneficiary.name,
        expense.amount,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [expenses, query, accountFilter, categoryFilter, fromDate, toDate])

  function openCreate() {
    setSheetMode('create')
    setSelected(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(expense: Expense) {
    if (!expense.capabilities.canReplace && !expense.capabilities.canVoid) {
      return
    }
    setSheetMode('edit')
    setSelected(expense)
    setFormError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    if (submitting) {
      return
    }
    setSheetOpen(false)
    setSelected(null)
    setFormError(null)
  }

  async function handleSubmit(values: ExpenseFormValues) {
    if (!household) {
      setFormError(t('expenses.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (sheetMode === 'create') {
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
      setSheetOpen(false)
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
      setSheetOpen(false)
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
    accounts.length > 0 && categories.length > 0 && beneficiaries.length > 0

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
                  {account.name}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('expenses.fields.date')}</TableHead>
                  <TableHead>{t('expenses.fields.amount')}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('expenses.fields.account')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('expenses.fields.category')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('expenses.fields.beneficiary')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('expenses.fields.note')}
                  </TableHead>
                  <TableHead className="w-[1%] text-right">
                    {t('expenses.fields.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => {
                  const canOpen =
                    expense.capabilities.canReplace ||
                    expense.capabilities.canVoid
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.effectiveDate}</TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatMoney(expense.amount, expense.currency)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {expense.account.name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {expense.category.name}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {expense.beneficiary.name}
                      </TableCell>
                      <TableCell className="hidden max-w-[14rem] truncate md:table-cell">
                        {expense.note || '—'}
                      </TableCell>
                      <TableCell className="text-right">
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

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet()
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === 'create'
                ? t('expenses.form.createTitle')
                : t('expenses.form.editTitle')}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'create'
                ? t('expenses.form.createHint')
                : t('expenses.form.editHint')}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ExpenseForm
              key={
                sheetMode === 'edit' && selected
                  ? `edit-${selected.id}-${selected.version}`
                  : `create-${accounts.length}-${categories.length}-${beneficiaries.length}`
              }
              mode={sheetMode}
              expense={selected}
              accounts={accounts}
              categories={categories}
              beneficiaries={beneficiaries}
              currency={currency}
              submitting={submitting}
              error={formError}
              onSubmit={handleSubmit}
              onCancel={closeSheet}
              onVoid={
                sheetMode === 'edit' && selected?.capabilities.canVoid
                  ? handleVoid
                  : undefined
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
