import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountType, CreateAccountInput } from '@/api/accounts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { householdToday } from '@/lib/household-date'
import { isSignedMoneyString } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

const ACCOUNT_TYPES: AccountType[] = ['CASH', 'WALLET', 'BANK']

export type AccountFormValues = CreateAccountInput

type AccountFormProps = {
  defaultSortOrder: number
  currency: string
  /** IANA timezone from the household (e.g. Asia/Yangon). */
  timeZone: string
  submitting: boolean
  error: string | null
  onSubmit: (values: AccountFormValues) => Promise<void>
  onCancel: () => void
}

function initialValues(
  defaultSortOrder: number,
  timeZone: string,
): AccountFormValues {
  return {
    name: '',
    type: 'CASH',
    ownerLabel: '',
    openedOn: householdToday(timeZone),
    openingAmount: '0',
    sortOrder: defaultSortOrder,
  }
}

export function AccountForm({
  defaultSortOrder,
  currency,
  timeZone,
  submitting,
  error,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<AccountFormValues>(() =>
    initialValues(defaultSortOrder, timeZone),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const name = values.name.trim()
    const ownerLabel = values.ownerLabel.trim()

    if (!name) {
      setLocalError(t('accounts.form.nameRequired'))
      return
    }
    if (name.length > 120) {
      setLocalError(t('accounts.form.nameTooLong'))
      return
    }
    if (!ownerLabel) {
      setLocalError(t('accounts.form.ownerRequired'))
      return
    }
    if (ownerLabel.length > 120) {
      setLocalError(t('accounts.form.ownerTooLong'))
      return
    }
    if (!ACCOUNT_TYPES.includes(values.type)) {
      setLocalError(t('accounts.form.typeInvalid'))
      return
    }
    if (!Number.isInteger(values.sortOrder)) {
      setLocalError(t('accounts.form.sortInvalid'))
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.openedOn)) {
      setLocalError(t('accounts.form.openedOnInvalid'))
      return
    }
    if (!isSignedMoneyString(values.openingAmount)) {
      setLocalError(t('accounts.form.openingAmountInvalid'))
      return
    }

    await onSubmit({
      name,
      type: values.type,
      ownerLabel,
      openedOn: values.openedOn,
      openingAmount: values.openingAmount.trim(),
      sortOrder: values.sortOrder,
    })
  }

  const displayError = localError ?? error

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {displayError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('accounts.form.errorTitle')}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="account-name">{t('accounts.fields.name')}</Label>
        <Input
          id="account-name"
          value={values.name}
          maxLength={120}
          autoComplete="off"
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="account-type">{t('accounts.fields.type')}</Label>
        <select
          id="account-type"
          className={selectClassName}
          value={values.type}
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              type: event.target.value as AccountType,
            }))
          }
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`accounts.types.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="account-owner">{t('accounts.fields.owner')}</Label>
        <Input
          id="account-owner"
          value={values.ownerLabel}
          maxLength={120}
          autoComplete="off"
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              ownerLabel: event.target.value,
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="account-opened-on">
          {t('accounts.fields.openedOn')}
        </Label>
        <Input
          id="account-opened-on"
          type="date"
          value={values.openedOn}
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              openedOn: event.target.value,
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="account-opening-amount">
          {t('accounts.fields.openingAmount', { currency })}
        </Label>
        <Input
          id="account-opening-amount"
          inputMode="numeric"
          value={values.openingAmount}
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              openingAmount: event.target.value,
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          {t('accounts.form.openingAmountHint')}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="account-sort">{t('accounts.fields.sortOrder')}</Label>
        <Input
          id="account-sort"
          type="number"
          step={1}
          value={values.sortOrder}
          disabled={submitting}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              sortOrder: Number(event.target.value),
            }))
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? t('accounts.form.saving') : t('accounts.form.create')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
