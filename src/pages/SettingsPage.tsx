import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('language.label')}</CardTitle>
          <CardDescription>{t('settings.languageHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('theme.label')}</CardTitle>
          <CardDescription>{t('settings.themeHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher showLabels />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.session')}</CardTitle>
          <CardDescription>
            {user
              ? t('settings.signedInAs', {
                  name: user.displayName,
                  email: user.email,
                })
              : t('settings.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {user ? (
            <p className="text-sm text-muted-foreground">
              {t('settings.role', { role: user.role })}
            </p>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              void logout()
            }}
          >
            {t('nav.logout')}
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
