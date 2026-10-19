import { apiFetch } from '@/api/client'

export type Beneficiary = {
  id: string
  name: string
  kind: string
  sortOrder: number
  status: string
  version: number
}

export async function listBeneficiaries(
  householdId: string,
  status = 'ACTIVE',
): Promise<Beneficiary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<Beneficiary[]>(
    `/api/v1/households/${householdId}/beneficiaries${query}`,
  )
}
