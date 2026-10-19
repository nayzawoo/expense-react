import { createContext } from 'react'

import type { CurrentUser, Household } from '@/api/types'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export type AuthContextValue = {
  status: AuthStatus
  user: CurrentUser | null
  household: Household | null
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
