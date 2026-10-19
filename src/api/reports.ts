import { apiFetch } from '@/api/client'
import type { AnalyticsSnapshot } from '@/api/types'

export async function fetchAnalytics(
  householdId: string,
  asOf?: string,
): Promise<AnalyticsSnapshot> {
  const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''
  return apiFetch<AnalyticsSnapshot>(
    `/api/v1/households/${householdId}/reports/analytics${query}`,
  )
}
