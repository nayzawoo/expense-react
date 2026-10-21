import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CATEGORY_ICON_KEYS,
  type Category,
  type CategoryWriteInput,
} from '@/api/categories'
import { CategoryIconPicker } from '@/components/categories/CategoryIconPicker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEFAULT_COLOR = '#64748B'

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

export type CategoryFormValues = CategoryWriteInput

type CategoryFormProps = {
  mode: 'create' | 'edit'
  category?: Category | null
  defaultSortOrder: number
  submitting: boolean
  error: string | null
  onSubmit: (values: CategoryFormValues) => Promise<void>
  onCancel: () => void
}

function initialValues(
  mode: 'create' | 'edit',
  category: Category | null | undefined,
  defaultSortOrder: number,
): CategoryFormValues {
  if (mode === 'edit' && category) {
    return {
      name: category.name,
      color: category.color,
      iconKey: category.iconKey,
      sortOrder: category.sortOrder,
    }
  }

  return {
    name: '',
    color: DEFAULT_COLOR,
    iconKey: 'other',
    sortOrder: defaultSortOrder,
  }
}

export function CategoryForm({
  mode,
  category,
  defaultSortOrder,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<CategoryFormValues>(() =>
    initialValues(mode, category, defaultSortOrder),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const name = values.name.trim()
    if (!name) {
      setLocalError(t('categories.form.nameRequired'))
      return
    }
    if (name.length > 120) {
      setLocalError(t('categories.form.nameTooLong'))
      return
    }
    if (!isHexColor(values.color)) {
      setLocalError(t('categories.form.colorInvalid'))
      return
    }
    if (
      !CATEGORY_ICON_KEYS.includes(
        values.iconKey as (typeof CATEGORY_ICON_KEYS)[number],
      )
    ) {
      setLocalError(t('categories.form.iconInvalid'))
      return
    }
    if (!Number.isInteger(values.sortOrder)) {
      setLocalError(t('categories.form.sortInvalid'))
      return
    }

    await onSubmit({
      name,
      color: values.color.toUpperCase(),
      iconKey: values.iconKey,
      sortOrder: values.sortOrder,
    })
  }

  const displayError = localError ?? error
  const previewColor = isHexColor(values.color) ? values.color : undefined

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {displayError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('categories.form.errorTitle')}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="category-name">{t('categories.fields.name')}</Label>
        <Input
          id="category-name"
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
        <Label htmlFor="category-color">{t('categories.fields.color')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="category-color"
            type="color"
            className="h-8 w-12 cursor-pointer p-1"
            value={isHexColor(values.color) ? values.color : DEFAULT_COLOR}
            disabled={submitting}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                color: event.target.value.toUpperCase(),
              }))
            }
            aria-label={t('categories.fields.color')}
          />
          <Input
            value={values.color}
            maxLength={7}
            spellCheck={false}
            disabled={submitting}
            placeholder="#64748B"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
            aria-label={t('categories.fields.colorHex')}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category-icon">{t('categories.fields.icon')}</Label>
        <CategoryIconPicker
          id="category-icon"
          value={values.iconKey}
          color={previewColor}
          disabled={submitting}
          onChange={(iconKey) =>
            setValues((current) => ({ ...current, iconKey }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category-sort">{t('categories.fields.sortOrder')}</Label>
        <Input
          id="category-sort"
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
          {submitting
            ? t('categories.form.saving')
            : mode === 'create'
              ? t('categories.form.create')
              : t('categories.form.save')}
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
