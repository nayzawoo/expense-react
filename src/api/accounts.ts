import { apiFetch } from '@/api/client'
import type { Account } from '@/api/types'

export async function listAccounts(householdId: string): Promise<Account[]> {
  return apiFetch<Account[]>(`/api/v1/households/${householdId}/accounts`)
}
