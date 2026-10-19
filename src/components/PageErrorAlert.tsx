import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type PageErrorAlertProps = {
  title: string
  message: string
  onRetry?: () => void
}

/** Shared page-level load error with optional retry. */
export function PageErrorAlert({
  title,
  message,
  onRetry,
}: PageErrorAlertProps) {
  const { t } = useTranslation()

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
