import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  changePassword as changePasswordRequest,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from '@/api/auth'
import { clearCsrf, setUnauthorizedHandler } from '@/api/client'
import { isApiError } from '@/api/errors'
import { fetchHousehold } from '@/api/household'
import type { CurrentUser, Household } from '@/api/types'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/auth/auth-context'
import { useQualifyingActivity } from '@/auth/useQualifyingActivity'

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
  const sessionEpoch = useRef(0)

  const invalidateSession = useCallback(() => {
    sessionEpoch.current += 1
    clearCsrf()
    setUser(null)
    setHousehold(null)
    setStatus('anonymous')
    setError(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      invalidateSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [invalidateSession])

  const refreshSession = useCallback(async () => {
    const epoch = sessionEpoch.current
    try {
      const nextUser = await fetchCurrentUser()
      if (epoch !== sessionEpoch.current) {
        return
      }
      setUser(nextUser)
      if (nextUser.mustChangePassword) {
        setHousehold(null)
      } else {
        setHousehold(await loadHouseholdSafe())
      }
      if (epoch !== sessionEpoch.current) {
        return
      }
      setStatus('authenticated')
      setError(null)
    } catch (err) {
      if (epoch !== sessionEpoch.current) {
        return
      }
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
      clearCsrf()
      setUser(null)
      setHousehold(null)
      setStatus('anonymous')
      setError(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Logout failed — session may still be active'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changePasswordRequest(currentPassword, newPassword)
      clearCsrf()
      setUser(null)
      setHousehold(null)
      setStatus('anonymous')
      setError(null)
    },
    [],
  )

  useQualifyingActivity(
    status === 'authenticated' && Boolean(user) && !user?.mustChangePassword,
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
