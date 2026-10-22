import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Beneficiary } from '@/api/beneficiaries'
import type { Income } from '@/api/incomes'
import type { Account } from '@/api/types'
import { PageLoading } from '@/components/PageLoading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { householdToday } from '@/lib/household-date'
import {
  INCOME_NOTE_MAX,
  INCOME_REASON_MAX,
  isValidIncomeAmount,
  normalizeIncomeNote,
  normalizeIncomeReason,
} from '@/lib/income-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

export type IncomeFormValues = {
  effectiveDate: string
  amount: string
  accountId: string
  beneficiaryId: string
  note: string
}

type IncomeFormProps = {
  mode: 'create' | 'detail'
  income?: Income | null
  accounts: Account[]
  beneficiaries: Beneficiary[]
  currency: string
  /** IANA timezone from the household. */
  timeZone: string
  submitting: boolean
  locked?: boolean
  detailLoading?: boolean
  error: string | null
  onSubmit: (values: IncomeFormValues) => Promise<void>
  onCancel: () => void
  onRetry?: () => void
  onVoid?: (reason: string) => Promise<void>
}

function initialValues(
  accounts: Account[],
  beneficiaries: Beneficiary[],
  timeZone: string,
): IncomeFormValues {
  return {
    effectiveDate: householdToday(timeZone),
    amount: '',
    accountId: accounts[0]?.id ?? '',
    beneficiaryId: beneficiaries[0]?.id ?? '',
    note: '',
  }
}

export function IncomeForm({
  mode,
  income,
  accounts,
  beneficiaries,
  currency,
  timeZone,
  submitting,
  locked = false,
  detailLoading = false,
  error,
  onSubmit,
  onCancel,
  onRetry,
  onVoid,
}: IncomeFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<IncomeFormValues>(() =>
    initialValues(accounts, beneficiaries, timeZone),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  function update<K extends keyof IncomeFormValues>(
    key: K,
    value: IncomeFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const writing = submitting || voiding
  const fieldsBusy = writing || locked
  const canCreate = accounts.length > 0 && beneficiaries.length > 0
  const canVoid =
    mode === 'detail' &&
    !detailLoading &&
    Boolean(income?.capabilities.canVoid && onVoid) &&
    !locked

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode !== 'create' || fieldsBusy) {
      return
    }
    setLocalError(null)

    if (
      !values.effectiveDate ||
      !values.accountId ||
      !values.beneficiaryId
    ) {
      setLocalError(t('incomes.form.required'))
      return
    }
    if (!isValidIncomeAmount(values.amount)) {
      setLocalError(t('incomes.errors.invalidAmount'))
      return
    }
    const note = normalizeIncomeNote(values.note)
    if (note === null) {
      setLocalError(t('incomes.form.noteInvalid'))
      return
    }

    await onSubmit({
      ...values,
      amount: values.amount.trim(),
      note,
    })
  }

  async function handleVoid() {
    if (!onVoid || fieldsBusy) {
      return
    }
    const reason = normalizeIncomeReason(voidReason)
    if (!reason) {
      setLocalError(
        voidReason.trim()
          ? t('incomes.form.voidReasonInvalid')
          : t('incomes.form.voidReasonRequired'),
      )
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

  function errorAlert() {
    if (!error && !localError) {
      return null
    }
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('incomes.form.errorTitle')}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{error ?? localError}</span>
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={writing}
              onClick={() => void onRetry()}
            >
              {t('common.retry')}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  if (mode === 'detail') {
    if (detailLoading) {
      return (
        <div className="grid gap-4">
          {errorAlert()}
          <PageLoading />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={fieldsBusy}
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )
    }

    if (!income) {
      return (
        <div className="grid gap-4">
          {errorAlert()}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={fieldsBusy}
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-4">
        {errorAlert()}

        <dl className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">{t('incomes.fields.date')}</dt>
            <dd>{income.effectiveDate}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">
              {t('incomes.fields.amount')}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(income.amount, income.currency)}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">
              {t('incomes.fields.account')}
            </dt>
            <dd>{income.account.name}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">
              {t('incomes.fields.beneficiary')}
            </dt>
            <dd>{income.beneficiary.name}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">{t('incomes.fields.note')}</dt>
            <dd>{income.note || '—'}</dd>
          </div>
        </dl>

        {!canVoid ? (
          <Badge variant="secondary">{t('incomes.readOnly')}</Badge>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={fieldsBusy}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
        </div>

        {canVoid ? (
          <div className="grid gap-2 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t('incomes.form.voidHint')}
            </p>
            <Label htmlFor="income-void-reason">
              {t('incomes.fields.voidReason')}
            </Label>
            <Input
              id="income-void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              disabled={fieldsBusy}
              maxLength={INCOME_REASON_MAX}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={fieldsBusy}
              onClick={() => void handleVoid()}
            >
              {voiding ? t('incomes.form.voiding') : t('incomes.form.void')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {errorAlert()}

      <div className="grid gap-2">
        <Label htmlFor="income-date">{t('incomes.fields.date')}</Label>
        <Input
          id="income-date"
          type="date"
          value={values.effectiveDate}
          onChange={(event) => update('effectiveDate', event.target.value)}
          disabled={fieldsBusy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="income-amount">
          {t('incomes.fields.amount')} ({currency})
        </Label>
        <Input
          id="income-amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('incomes.form.amountPlaceholder')}
          value={values.amount}
          onChange={(event) => update('amount', event.target.value)}
          disabled={fieldsBusy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="income-account">{t('incomes.fields.account')}</Label>
        <select
          id="income-account"
          className={selectClassName}
          value={values.accountId}
          onChange={(event) => update('accountId', event.target.value)}
          disabled={fieldsBusy || accounts.length === 0}
          required
        >
          {accounts.length === 0 ? (
            <option value="">{t('incomes.form.noAccounts')}</option>
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
        <Label htmlFor="income-beneficiary">
          {t('incomes.fields.beneficiary')}
        </Label>
        <select
          id="income-beneficiary"
          className={selectClassName}
          value={values.beneficiaryId}
          onChange={(event) => update('beneficiaryId', event.target.value)}
          disabled={fieldsBusy || beneficiaries.length === 0}
          required
        >
          {beneficiaries.length === 0 ? (
            <option value="">{t('incomes.form.noBeneficiaries')}</option>
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
        <Label htmlFor="income-note">{t('incomes.fields.note')}</Label>
        <Input
          id="income-note"
          value={values.note}
          onChange={(event) => update('note', event.target.value)}
          disabled={fieldsBusy}
          maxLength={INCOME_NOTE_MAX}
          placeholder={t('incomes.form.notePlaceholder')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={fieldsBusy || !canCreate}>
          {submitting ? t('incomes.form.saving') : t('incomes.form.create')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={fieldsBusy}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
