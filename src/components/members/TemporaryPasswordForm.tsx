import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN_PASSWORD_LENGTH = 8

type TemporaryPasswordFormProps = {
  submitting: boolean
  error: string | null
  onSubmit: (temporaryPassword: string) => Promise<void>
  onCancel: () => void
}

export function TemporaryPasswordForm({
  submitting,
  error,
  onSubmit,
  onCancel,
}: TemporaryPasswordFormProps) {
  const { t } = useTranslation()
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!temporaryPassword || temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalError(t('members.form.passwordTooShort'))
      return
    }

    await onSubmit(temporaryPassword)
  }

  const displayError = localError ?? error

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {displayError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('members.form.errorTitle')}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="member-reset-temporary-password">
          {t('members.fields.temporaryPassword')}
        </Label>
        <Input
          id="member-reset-temporary-password"
          type="password"
          value={temporaryPassword}
          onChange={(event) => setTemporaryPassword(event.target.value)}
          disabled={submitting}
          autoComplete="new-password"
          placeholder={t('members.form.passwordPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('members.form.resetPasswordHint')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t('members.form.saving')
            : t('members.form.resetPassword')}
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
