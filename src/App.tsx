import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireGuest } from '@/auth/RequireGuest'
import { AppLayout } from '@/components/AppLayout'
import { AccountsPage } from '@/pages/AccountsPage'
import { BeneficiariesPage } from '@/pages/BeneficiariesPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ThemeProvider } from '@/theme/ThemeProvider'

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
                <Route index element={<DashboardPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="beneficiaries" element={<BeneficiariesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="change-password" element={<ChangePasswordPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
