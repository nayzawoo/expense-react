import { Link } from 'react-router-dom'
import { PlusCircle, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function ExpensesPage() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('expenses.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('expenses.subtitle')}
          </p>
        </div>
        <Button disabled>
          <PlusCircle data-icon="inline-start" />
          {t('expenses.add')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" aria-hidden />
            {t('expenses.title')}
          </CardTitle>
          <CardDescription>{t('expenses.empty')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t('common.backHome')}
          </Link>
        </CardContent>
      </Card>
    </section>
  )
}
