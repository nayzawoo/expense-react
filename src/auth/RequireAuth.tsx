import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
import { Skeleton } from '@/components/ui/skeleton'

export function RequireAuth() {
  const { status, user } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (status === 'loading') {
    return (
      <div className="mx-auto grid w-full max-w-md gap-3 p-6" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <p className="sr-only">{t('common.loading')}</p>
      </div>
    )
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}
