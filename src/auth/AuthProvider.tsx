import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  changePassword as changePasswordRequest,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from '@/api/auth'
import {
  advanceAuthGeneration,
  clearCsrf,
  getAuthGeneration,
  setUnauthorizedHandler,
} from '@/api/client'
import { isApiError } from '@/api/errors'
import { fetchHousehold } from '@/api/household'
import type { CurrentUser, Household } from '@/api/types'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/auth/auth-context'
import { useQualifyingActivity } from '@/auth/useQualifyingActivity'
import { setIdempotencyActor } from '@/lib/idempotency'

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

function generationChanged(generation: number): boolean {
  return generation !== getAuthGeneration()
}

function rememberActor(user: CurrentUser | null): void {
  setIdempotencyActor(user?.id ?? null)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [error, setError] = useState<string | null>(null)

  const invalidateSession = useCallback(() => {
    advanceAuthGeneration()
    clearCsrf()
    rememberActor(null)
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
    const generation = getAuthGeneration()
    try {
      const nextUser = await fetchCurrentUser()
      if (generationChanged(generation)) {
        return
      }
      const nextHousehold = nextUser.mustChangePassword
        ? null
        : await loadHouseholdSafe()
      if (generationChanged(generation)) {
        return
      }
      rememberActor(nextUser)
      setUser(nextUser)
      setHousehold(nextHousehold)
      setStatus('authenticated')
      setError(null)
    } catch (err) {
      if (generationChanged(generation)) {
        return
      }
      rememberActor(null)
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
    const started = getAuthGeneration()
    const nextUser = await loginRequest(email, password)
    if (generationChanged(started)) {
      return
    }
    const generation = advanceAuthGeneration()
    const nextHousehold = nextUser.mustChangePassword
      ? null
      : await loadHouseholdSafe()
    if (generationChanged(generation)) {
      return
    }
    rememberActor(nextUser)
    setUser(nextUser)
    setHousehold(nextHousehold)
    setStatus('authenticated')
    setError(null)
  }, [])

  const logout = useCallback(async () => {
    const started = getAuthGeneration()
    try {
      await logoutRequest()
      if (generationChanged(started)) {
        return
      }
      advanceAuthGeneration()
      clearCsrf()
      rememberActor(null)
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
      const started = getAuthGeneration()
      await changePasswordRequest(currentPassword, newPassword)
      if (generationChanged(started)) {
        return
      }
      advanceAuthGeneration()
      clearCsrf()
      rememberActor(null)
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
