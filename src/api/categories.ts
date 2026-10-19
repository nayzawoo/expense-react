import { apiFetch } from '@/api/client'

export type Category = {
  id: string
  name: string
  color: string
  iconKey: string
  sortOrder: number
  status: string
  version: number
}

export async function listCategories(
  householdId: string,
  status = 'ACTIVE',
): Promise<Category[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<Category[]>(
    `/api/v1/households/${householdId}/categories${query}`,
  )
}
