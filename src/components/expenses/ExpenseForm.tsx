import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/api/types'
import type { Beneficiary } from '@/api/beneficiaries'
import type { Category } from '@/api/categories'
import type { Expense } from '@/api/expenses'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isPositiveMoneyString } from '@/lib/expense-errors'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

export type ExpenseFormValues = {
  effectiveDate: string
  amount: string
  accountId: string
  categoryId: string
  beneficiaryId: string
  note: string
  changeReason: string
}

type ExpenseFormProps = {
  mode: 'create' | 'edit'
  expense?: Expense | null
  accounts: Account[]
  categories: Category[]
  beneficiaries: Beneficiary[]
  currency: string
  submitting: boolean
  error: string | null
  onSubmit: (values: ExpenseFormValues) => Promise<void>
  onCancel: () => void
  onVoid?: (reason: string) => Promise<void>
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function initialValues(
  mode: 'create' | 'edit',
  expense: Expense | null | undefined,
  accounts: Account[],
  categories: Category[],
  beneficiaries: Beneficiary[],
): ExpenseFormValues {
  if (mode === 'edit' && expense) {
    return {
      effectiveDate: expense.effectiveDate,
      amount: expense.amount,
      accountId: expense.account.id,
      categoryId: expense.category.id,
      beneficiaryId: expense.beneficiary.id,
      note: expense.note ?? '',
      changeReason: '',
    }
  }

  return {
    effectiveDate: todayIso(),
    amount: '',
    accountId: accounts[0]?.id ?? '',
    categoryId: categories[0]?.id ?? '',
    beneficiaryId: beneficiaries[0]?.id ?? '',
    note: '',
    changeReason: '',
  }
}

export function ExpenseForm({
  mode,
  expense,
  accounts,
  categories,
  beneficiaries,
  currency,
  submitting,
  error,
  onSubmit,
  onCancel,
  onVoid,
}: ExpenseFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    initialValues(mode, expense, accounts, categories, beneficiaries),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  function update<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (
      !values.effectiveDate ||
      !values.accountId ||
      !values.categoryId ||
      !values.beneficiaryId
    ) {
      setLocalError(t('expenses.form.required'))
      return
    }
    if (!isPositiveMoneyString(values.amount)) {
      setLocalError(t('expenses.errors.invalidAmount'))
      return
    }
    if (mode === 'edit' && !values.changeReason.trim()) {
      setLocalError(t('expenses.form.changeReasonRequired'))
      return
    }
    if (values.note.includes('\n') || values.note.includes('\r')) {
      setLocalError(t('expenses.form.noteInvalid'))
      return
    }

    await onSubmit({
      ...values,
      amount: values.amount.trim(),
      note: values.note.trim(),
      changeReason: values.changeReason.trim(),
    })
  }

  async function handleVoid() {
    if (!onVoid) {
      return
    }
    const reason = voidReason.trim()
    if (!reason) {
      setLocalError(t('expenses.form.voidReasonRequired'))
      return
    }
    setLocalError(null)
    setVoiding(true)
    try {
      await onVoid(reason)
    } finally {
      setVoiding(false)
    }
  }

  const busy = submitting || voiding
  const canVoid = mode === 'edit' && expense?.capabilities.canVoid && onVoid

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {(error || localError) && (
        <Alert variant="destructive">
          <AlertTitle>{t('expenses.form.errorTitle')}</AlertTitle>
          <AlertDescription>{error ?? localError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="expense-date">{t('expenses.fields.date')}</Label>
        <Input
          id="expense-date"
          type="date"
          value={values.effectiveDate}
          onChange={(event) => update('effectiveDate', event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expense-amount">
          {t('expenses.fields.amount')} ({currency})
        </Label>
        <Input
          id="expense-amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('expenses.form.amountPlaceholder')}
          value={values.amount}
          onChange={(event) => update('amount', event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expense-account">{t('expenses.fields.account')}</Label>
        <select
          id="expense-account"
          className={selectClassName}
          value={values.accountId}
          onChange={(event) => update('accountId', event.target.value)}
          disabled={busy || accounts.length === 0}
          required
        >
          {accounts.length === 0 ? (
            <option value="">{t('expenses.form.noAccounts')}</option>
          ) : (
            accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expense-category">{t('expenses.fields.category')}</Label>
        <select
          id="expense-category"
          className={selectClassName}
          value={values.categoryId}
          onChange={(event) => update('categoryId', event.target.value)}
          disabled={busy || categories.length === 0}
          required
        >
          {categories.length === 0 ? (
            <option value="">{t('expenses.form.noCategories')}</option>
          ) : (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expense-beneficiary">
          {t('expenses.fields.beneficiary')}
        </Label>
        <select
          id="expense-beneficiary"
          className={selectClassName}
          value={values.beneficiaryId}
          onChange={(event) => update('beneficiaryId', event.target.value)}
          disabled={busy || beneficiaries.length === 0}
          required
        >
          {beneficiaries.length === 0 ? (
            <option value="">{t('expenses.form.noBeneficiaries')}</option>
          ) : (
            beneficiaries.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.id}>
                {beneficiary.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expense-note">{t('expenses.fields.note')}</Label>
        <Input
          id="expense-note"
          value={values.note}
          onChange={(event) => update('note', event.target.value)}
          disabled={busy}
          maxLength={2000}
          placeholder={t('expenses.form.notePlaceholder')}
        />
      </div>

      {mode === 'edit' ? (
        <div className="grid gap-2">
          <Label htmlFor="expense-change-reason">
            {t('expenses.fields.changeReason')}
          </Label>
          <Input
            id="expense-change-reason"
            value={values.changeReason}
            onChange={(event) => update('changeReason', event.target.value)}
            disabled={busy}
            maxLength={500}
            required
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || accounts.length === 0}>
          {submitting
            ? t('expenses.form.saving')
            : mode === 'create'
              ? t('expenses.form.create')
              : t('expenses.form.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
      </div>

      {canVoid ? (
        <div className="grid gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {t('expenses.form.voidHint')}
          </p>
          <Label htmlFor="expense-void-reason">
            {t('expenses.fields.voidReason')}
          </Label>
          <Input
            id="expense-void-reason"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            disabled={busy}
            maxLength={500}
          />
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void handleVoid()}
          >
            {voiding ? t('expenses.form.voiding') : t('expenses.form.void')}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
