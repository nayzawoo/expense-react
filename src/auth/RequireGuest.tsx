import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
import { Skeleton } from '@/components/ui/skeleton'

export function RequireGuest() {
  const { status, user } = useAuth()
  const { t } = useTranslation()

  if (status === 'loading') {
    return (
      <div className="mx-auto grid w-full max-w-md gap-3 p-6" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <p className="sr-only">{t('common.loading')}</p>
      </div>
    )
  }

  if (status === 'authenticated' && user) {
    return (
      <Navigate
        to={user.mustChangePassword ? '/change-password' : '/'}
        replace
      />
    )
  }

  return <Outlet />
}
