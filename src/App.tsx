import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireGuest } from '@/auth/RequireGuest'
import { AppLayout } from '@/components/AppLayout'
import { PageLoading } from '@/components/PageLoading'
import { Toaster } from '@/components/ui/sonner'
import { AccountsPage } from '@/pages/AccountsPage'
import { BeneficiariesPage } from '@/pages/BeneficiariesPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { LoginPage } from '@/pages/LoginPage'
import { MembersPage } from '@/pages/MembersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransfersPage } from '@/pages/TransfersPage'
import { ThemeProvider } from '@/theme/ThemeProvider'

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  })),
)

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route
                  index
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="transfers" element={<TransfersPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="beneficiaries" element={<BeneficiariesPage />} />
                <Route
                  path="reports"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <ReportsPage />
                    </Suspense>
                  }
                />
                <Route path="members" element={<MembersPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="change-password" element={<ChangePasswordPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  )
}
