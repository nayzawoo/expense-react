import { apiFetch } from '@/api/client'
import type { DashboardSnapshot } from '@/api/types'

export async function fetchDashboard(
  householdId: string,
  asOf?: string,
): Promise<DashboardSnapshot> {
  const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''
  return apiFetch<DashboardSnapshot>(
    `/api/v1/households/${householdId}/reports/dashboard${query}`,
  )
}
