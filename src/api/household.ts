import { apiFetch } from '@/api/client'
import type { Household } from '@/api/types'

export async function fetchHousehold(): Promise<Household> {
  return apiFetch<Household>('/api/v1/household')
}
