import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './components/AppLayout'
import { AccountsPage } from './pages/AccountsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
