import { apiFetch } from '@/api/client'

export type CategoryStatus = 'ACTIVE' | 'ARCHIVED'

export type Category = {
  id: string
  name: string
  color: string
  iconKey: string
  sortOrder: number
  status: CategoryStatus | string
  version: number
}

export type CategoryWriteInput = {
  name: string
  color: string
  iconKey: string
  sortOrder: number
}

export type CategoryUpdateInput = Partial<CategoryWriteInput>

/** Supported Spring icon vocabulary (CategoryService.ICON_KEYS). */
export const CATEGORY_ICON_KEYS = [
  'food',
  'transport',
  'home',
  'health',
  'shopping',
  'bills',
  'education',
  'entertainment',
  'other',
] as const

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number]

export async function listCategories(
  householdId: string,
  status: CategoryStatus | 'ALL' | '' = 'ALL',
): Promise<Category[]> {
  const query =
    status && status !== 'ALL'
      ? `?status=${encodeURIComponent(status)}`
      : ''
  return apiFetch<Category[]>(
    `/api/v1/households/${householdId}/categories${query}`,
  )
}

export async function getCategory(
  householdId: string,
  categoryId: string,
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/households/${householdId}/categories/${categoryId}`,
  )
}

export async function createCategory(
  householdId: string,
  input: CategoryWriteInput,
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/households/${householdId}/categories`,
    {
      method: 'POST',
      csrf: true,
      body: input,
    },
  )
}

export async function updateCategory(
  householdId: string,
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/households/${householdId}/categories/${categoryId}`,
    {
      method: 'PUT',
      csrf: true,
      body: input,
    },
  )
}

export async function updateCategoryStatus(
  householdId: string,
  categoryId: string,
  status: CategoryStatus,
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/households/${householdId}/categories/${categoryId}/status`,
    {
      method: 'PATCH',
      csrf: true,
      body: { status },
    },
  )
}
