import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPassword || !newPassword) {
      setError(t('password.required'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('password.tooShort'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await changePassword(currentPassword, newPassword)
      navigate('/login?passwordChanged=1', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError(t('password.failed'))
      } else if (isApiError(err) && err.status === 400) {
        setError(t('password.tooShort'))
      } else if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else {
        setError(t('password.failed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-md gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('password.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('password.subtitle')}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('password.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('password.title')}</CardTitle>
          <CardDescription>{t('password.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">{t('password.current')}</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">{t('password.next')}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={submitting}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              <KeyRound data-icon="inline-start" />
              {submitting ? t('password.submitting') : t('password.submit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                void logout().then(() => navigate('/login', { replace: true }))
              }}
            >
              {t('nav.logout')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
