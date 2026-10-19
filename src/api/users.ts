import { apiFetch } from '@/api/client'
import type { UserRole } from '@/api/types'

export type UserStatus = 'ACTIVE' | 'DISABLED'

export type HouseholdUser = {
  id: string
  email: string
  displayName: string
  role: UserRole | string
  status: UserStatus | string
  mustChangePassword: boolean
  passwordChangeCompleted: boolean
}

export type CreateHouseholdUserInput = {
  displayName: string
  email: string
  temporaryPassword: string
  role: UserRole
}

export type UpdateHouseholdUserInput = {
  displayName?: string
  email?: string
  role?: UserRole
  status?: UserStatus
}

export async function listHouseholdUsers(
  householdId: string,
): Promise<HouseholdUser[]> {
  return apiFetch<HouseholdUser[]>(
    `/api/v1/households/${householdId}/users`,
  )
}

export async function getHouseholdUser(
  householdId: string,
  userId: string,
): Promise<HouseholdUser> {
  return apiFetch<HouseholdUser>(
    `/api/v1/households/${householdId}/users/${userId}`,
  )
}

export async function createHouseholdUser(
  householdId: string,
  input: CreateHouseholdUserInput,
): Promise<HouseholdUser> {
  return apiFetch<HouseholdUser>(
    `/api/v1/households/${householdId}/users`,
    {
      method: 'POST',
      csrf: true,
      body: input,
    },
  )
}

export async function updateHouseholdUser(
  householdId: string,
  userId: string,
  input: UpdateHouseholdUserInput,
): Promise<HouseholdUser> {
  return apiFetch<HouseholdUser>(
    `/api/v1/households/${householdId}/users/${userId}`,
    {
      method: 'PATCH',
      csrf: true,
      body: input,
    },
  )
}

export async function assignTemporaryPassword(
  householdId: string,
  userId: string,
  temporaryPassword: string,
): Promise<void> {
  return apiFetch<void>(
    `/api/v1/households/${householdId}/users/${userId}/temporary-password`,
    {
      method: 'POST',
      csrf: true,
      body: { temporaryPassword },
    },
  )
}
