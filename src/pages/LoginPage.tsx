import { LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-md gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('login.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.demoNote')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                disabled
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                disabled
              />
            </div>
            <Button type="submit" disabled className="w-full">
              <LogIn data-icon="inline-start" />
              {t('login.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">{t('common.comingSoon')}</p>
        </CardFooter>
      </Card>
    </section>
  )
}
