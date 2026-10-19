import { apiFetch } from '@/api/client'

export type BeneficiaryKind = 'PERSON' | 'HOUSEHOLD' | 'OTHER'

export type BeneficiaryStatus = 'ACTIVE' | 'ARCHIVED'

export type Beneficiary = {
  id: string
  name: string
  kind: BeneficiaryKind | string
  sortOrder: number
  status: BeneficiaryStatus | string
  version: number
}

export type CreateBeneficiaryInput = {
  name: string
  kind: BeneficiaryKind
  sortOrder: number
}

export type UpdateBeneficiaryInput = {
  name?: string
  kind?: BeneficiaryKind
  sortOrder?: number
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

export async function getBeneficiary(
  householdId: string,
  beneficiaryId: string,
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(
    `/api/v1/households/${householdId}/beneficiaries/${beneficiaryId}`,
  )
}

export async function createBeneficiary(
  householdId: string,
  input: CreateBeneficiaryInput,
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(
    `/api/v1/households/${householdId}/beneficiaries`,
    {
      method: 'POST',
      csrf: true,
      body: input,
    },
  )
}

export async function updateBeneficiary(
  householdId: string,
  beneficiaryId: string,
  input: UpdateBeneficiaryInput,
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(
    `/api/v1/households/${householdId}/beneficiaries/${beneficiaryId}`,
    {
      method: 'PUT',
      csrf: true,
      body: input,
    },
  )
}

export async function updateBeneficiaryStatus(
  householdId: string,
  beneficiaryId: string,
  status: BeneficiaryStatus,
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(
    `/api/v1/households/${householdId}/beneficiaries/${beneficiaryId}/status`,
    {
      method: 'PATCH',
      csrf: true,
      body: { status },
    },
  )
}
