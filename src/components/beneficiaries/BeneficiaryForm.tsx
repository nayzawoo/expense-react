import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  Beneficiary,
  BeneficiaryKind,
  CreateBeneficiaryInput,
} from '@/api/beneficiaries'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

const KINDS: BeneficiaryKind[] = ['PERSON', 'HOUSEHOLD', 'OTHER']

export type BeneficiaryFormValues = CreateBeneficiaryInput

type BeneficiaryFormProps = {
  mode: 'create' | 'edit'
  beneficiary?: Beneficiary | null
  submitting: boolean
  error: string | null
  onSubmit: (values: BeneficiaryFormValues) => Promise<void>
  onCancel: () => void
}

function initialValues(
  mode: 'create' | 'edit',
  beneficiary: Beneficiary | null | undefined,
): BeneficiaryFormValues {
  if (mode === 'edit' && beneficiary) {
    return {
      name: beneficiary.name,
      kind: (beneficiary.kind as BeneficiaryKind) || 'PERSON',
      sortOrder: beneficiary.sortOrder,
    }
  }

  return {
    name: '',
    kind: 'PERSON',
    sortOrder: 0,
  }
}

export function BeneficiaryForm({
  mode,
  beneficiary,
  submitting,
  error,
  onSubmit,
  onCancel,
}: BeneficiaryFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<BeneficiaryFormValues>(() =>
    initialValues(mode, beneficiary),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  function update<K extends keyof BeneficiaryFormValues>(
    key: K,
    value: BeneficiaryFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const name = values.name.trim()
    if (!name) {
      setLocalError(t('beneficiaries.form.nameRequired'))
      return
    }
    if (name.length > 120) {
      setLocalError(t('beneficiaries.form.nameTooLong'))
      return
    }
    if (!KINDS.includes(values.kind)) {
      setLocalError(t('beneficiaries.form.kindRequired'))
      return
    }
    if (!Number.isInteger(values.sortOrder)) {
      setLocalError(t('beneficiaries.form.sortOrderInvalid'))
      return
    }

    await onSubmit({
      name,
      kind: values.kind,
      sortOrder: values.sortOrder,
    })
  }

  const displayError = localError ?? error

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {displayError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('beneficiaries.form.errorTitle')}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="beneficiary-name">{t('beneficiaries.fields.name')}</Label>
        <Input
          id="beneficiary-name"
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          disabled={submitting}
          maxLength={120}
          autoComplete="off"
          placeholder={t('beneficiaries.form.namePlaceholder')}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="beneficiary-kind">{t('beneficiaries.fields.kind')}</Label>
        <select
          id="beneficiary-kind"
          className={selectClassName}
          value={values.kind}
          onChange={(event) =>
            update('kind', event.target.value as BeneficiaryKind)
          }
          disabled={submitting}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`beneficiaries.kinds.${kind}`, { defaultValue: kind })}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="beneficiary-sort-order">
          {t('beneficiaries.fields.sortOrder')}
        </Label>
        <Input
          id="beneficiary-sort-order"
          type="number"
          step={1}
          value={String(values.sortOrder)}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10)
            update('sortOrder', Number.isNaN(next) ? 0 : next)
          }}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t('beneficiaries.form.saving')
            : mode === 'create'
              ? t('beneficiaries.form.create')
              : t('beneficiaries.form.save')}
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
