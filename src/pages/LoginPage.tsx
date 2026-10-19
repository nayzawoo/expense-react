import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
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
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('passwordChanged') === '1' ? t('password.success') : null
  })

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setInfo(null)
    if (!email.trim() || !password) {
      setError(t('login.required'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      if (isApiError(err) && (err.status === 401 || err.status === 400)) {
        setError(t('login.invalid'))
      } else if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else {
        setError(t('login.failed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-md gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('login.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {info ? (
        <Alert>
          <AlertTitle>{t('login.title')}</AlertTitle>
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('login.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <LogIn data-icon="inline-start" />
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
