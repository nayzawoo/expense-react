import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(() =>
    new URLSearchParams(window.location.search).get('passwordChanged') === '1',
  )

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setShowInfo(false)
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
    <section className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-5 px-5 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xl font-semibold tracking-tight">{t('app.name')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {showInfo ? (
        <Alert>
          <AlertTitle>{t('login.title')}</AlertTitle>
          <AlertDescription>{t('password.success')}</AlertDescription>
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
          <CardTitle>
            <h1 className="text-2xl leading-relaxed">{t('login.title')}</h1>
          </CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={onSubmit} aria-busy={submitting}>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="h-12 text-base"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="h-12 pr-12 text-base"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 size-10"
                  aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                  aria-pressed={showPassword}
                  disabled={submitting}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={submitting}>
              <LogIn data-icon="inline-start" />
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
