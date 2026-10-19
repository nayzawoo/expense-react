import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  changePassword as changePasswordRequest,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from '@/api/auth'
import { isApiError } from '@/api/errors'
import { fetchHousehold } from '@/api/household'
import type { CurrentUser, Household } from '@/api/types'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/auth/auth-context'

async function loadHouseholdSafe(): Promise<Household | null> {
  try {
    return await fetchHousehold()
  } catch (error) {
    if (isApiError(error) && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    try {
      const nextUser = await fetchCurrentUser()
      setUser(nextUser)
      if (nextUser.mustChangePassword) {
        setHousehold(null)
      } else {
        setHousehold(await loadHouseholdSafe())
      }
      setStatus('authenticated')
      setError(null)
    } catch (err) {
      setUser(null)
      setHousehold(null)
      if (isApiError(err) && err.status === 401) {
        setStatus('anonymous')
        setError(null)
        return
      }
      setStatus('anonymous')
      setError(err instanceof Error ? err.message : 'Session check failed')
    }
  }, [])

  useEffect(() => {
    // Bootstrap the Spring session once on mount.
    void refreshSession()
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const nextUser = await loginRequest(email, password)
    setUser(nextUser)
    if (nextUser.mustChangePassword) {
      setHousehold(null)
    } else {
      setHousehold(await loadHouseholdSafe())
    }
    setStatus('authenticated')
    setError(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      setUser(null)
      setHousehold(null)
      setStatus('anonymous')
      setError(null)
    }
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changePasswordRequest(currentPassword, newPassword)
      setUser(null)
      setHousehold(null)
      setStatus('anonymous')
      setError(null)
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      household,
      error,
      login,
      logout,
      changePassword,
      refreshSession,
      clearError: () => setError(null),
    }),
    [
      status,
      user,
      household,
      error,
      login,
      logout,
      changePassword,
      refreshSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
