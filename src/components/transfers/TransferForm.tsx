import { useState, type FormEvent } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/api/types'
import type { Transfer } from '@/api/transfers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isPositiveMoneyString } from '@/lib/expense-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

export type TransferFormValues = {
  effectiveDate: string
  amount: string
  sourceAccountId: string
  destinationAccountId: string
  note: string
}

type TransferFormProps = {
  mode: 'create' | 'detail'
  transfer?: Transfer | null
  accounts: Account[]
  currency: string
  submitting: boolean
  error: string | null
  onSubmit: (values: TransferFormValues) => Promise<void>
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
  accounts: Account[],
): TransferFormValues {
  const source = accounts[0]?.id ?? ''
  const destination =
    accounts.find((account) => account.id !== source)?.id ?? source
  return {
    effectiveDate: todayIso(),
    amount: '',
    sourceAccountId: source,
    destinationAccountId: destination,
    note: '',
  }
}

export function TransferForm({
  mode,
  transfer,
  accounts,
  currency,
  submitting,
  error,
  onSubmit,
  onCancel,
  onVoid,
}: TransferFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<TransferFormValues>(() =>
    initialValues(accounts),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  function update<K extends keyof TransferFormValues>(
    key: K,
    value: TransferFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode !== 'create') {
      return
    }
    setLocalError(null)

    if (
      !values.effectiveDate ||
      !values.sourceAccountId ||
      !values.destinationAccountId
    ) {
      setLocalError(t('transfers.form.required'))
      return
    }
    if (!isPositiveMoneyString(values.amount)) {
      setLocalError(t('transfers.errors.invalidAmount'))
      return
    }
    if (values.sourceAccountId === values.destinationAccountId) {
      setLocalError(t('transfers.errors.selfTransfer'))
      return
    }
    if (values.note.includes('\n') || values.note.includes('\r')) {
      setLocalError(t('transfers.form.noteInvalid'))
      return
    }

    await onSubmit({
      ...values,
      amount: values.amount.trim(),
      note: values.note.trim(),
    })
  }

  async function handleVoid() {
    if (!onVoid) {
      return
    }
    const reason = voidReason.trim()
    if (!reason) {
      setLocalError(t('transfers.form.voidReasonRequired'))
      return
    }
    if (reason.includes('\n') || reason.includes('\r')) {
      setLocalError(t('transfers.form.voidReasonInvalid'))
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
  const canVoid = mode === 'detail' && transfer?.capabilities.canVoid && onVoid
  const canCreate = accounts.length >= 2

  if (mode === 'detail' && transfer) {
    return (
      <div className="grid gap-4">
        {(error || localError) && (
          <Alert variant="destructive">
            <AlertTitle>{t('transfers.form.errorTitle')}</AlertTitle>
            <AlertDescription>{error ?? localError}</AlertDescription>
          </Alert>
        )}

        <dl className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">{t('transfers.fields.date')}</dt>
            <dd>{transfer.effectiveDate}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">
              {t('transfers.fields.amount')}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(transfer.amount, transfer.currency)}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">
              {t('transfers.fields.route')}
            </dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <span>{transfer.sourceAccount.name}</span>
              <ArrowRightLeft
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              <span>{transfer.destinationAccount.name}</span>
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">{t('transfers.fields.note')}</dt>
            <dd>{transfer.note || '—'}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>

        {canVoid ? (
          <div className="grid gap-2 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t('transfers.form.voidHint')}
            </p>
            <Label htmlFor="transfer-void-reason">
              {t('transfers.fields.voidReason')}
            </Label>
            <Input
              id="transfer-void-reason"
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
              {voiding ? t('transfers.form.voiding') : t('transfers.form.void')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {(error || localError) && (
        <Alert variant="destructive">
          <AlertTitle>{t('transfers.form.errorTitle')}</AlertTitle>
          <AlertDescription>{error ?? localError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="transfer-date">{t('transfers.fields.date')}</Label>
        <Input
          id="transfer-date"
          type="date"
          value={values.effectiveDate}
          onChange={(event) => update('effectiveDate', event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="transfer-amount">
          {t('transfers.fields.amount')} ({currency})
        </Label>
        <Input
          id="transfer-amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('transfers.form.amountPlaceholder')}
          value={values.amount}
          onChange={(event) => update('amount', event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="transfer-source">
          {t('transfers.fields.sourceAccount')}
        </Label>
        <select
          id="transfer-source"
          className={selectClassName}
          value={values.sourceAccountId}
          onChange={(event) => update('sourceAccountId', event.target.value)}
          disabled={busy || !canCreate}
          required
        >
          {!canCreate ? (
            <option value="">{t('transfers.form.needTwoAccounts')}</option>
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
        <Label htmlFor="transfer-destination">
          {t('transfers.fields.destinationAccount')}
        </Label>
        <select
          id="transfer-destination"
          className={selectClassName}
          value={values.destinationAccountId}
          onChange={(event) =>
            update('destinationAccountId', event.target.value)
          }
          disabled={busy || !canCreate}
          required
        >
          {!canCreate ? (
            <option value="">{t('transfers.form.needTwoAccounts')}</option>
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
        <Label htmlFor="transfer-note">{t('transfers.fields.note')}</Label>
        <Input
          id="transfer-note"
          value={values.note}
          onChange={(event) => update('note', event.target.value)}
          disabled={busy}
          maxLength={2000}
          placeholder={t('transfers.form.notePlaceholder')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !canCreate}>
          {submitting
            ? t('transfers.form.saving')
            : t('transfers.form.create')}
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
    </form>
  )
}
