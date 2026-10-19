import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AccountsPage() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('accounts.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" aria-hidden />
            {t('accounts.title')}
          </CardTitle>
          <CardDescription>{t('accounts.empty')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">{t('common.comingSoon')}</Badge>
        </CardContent>
      </Card>
    </section>
  )
}
