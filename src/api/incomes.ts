import { apiFetch } from '@/api/client'
import { withIdempotencyKey } from '@/lib/idempotency'

export type IncomeRef = {
  id: string
  name: string
  kind: string | null
}

export type IncomeActor = {
  userId: string
  displayName: string
}

export type IncomeCapabilities = {
  canVoid: boolean
}

export type Income = {
  id: string
  kind: 'INCOME'
  state: string
  effectiveDate: string
  amount: string
  currency: string
  note: string | null
  account: IncomeRef
  beneficiary: IncomeRef
  createdBy: IncomeActor
  recordedAt: string
  version: number
  revisionNo: number
  capabilities: IncomeCapabilities
}

export type CreateIncomeInput = {
  effectiveDate: string
  amount: string
  accountId: string
  beneficiaryId: string
  note?: string
}

export type VoidIncomeInput = {
  reason: string
}

function versionMatch(version: number): string {
  return `"${version}"`
}

export async function listIncomes(householdId: string): Promise<Income[]> {
  return apiFetch<Income[]>(`/api/v1/households/${householdId}/incomes`)
}

export async function getIncome(
  householdId: string,
  incomeId: string,
): Promise<Income> {
  return apiFetch<Income>(
    `/api/v1/households/${householdId}/incomes/${incomeId}`,
  )
}

export async function createIncome(
  householdId: string,
  input: CreateIncomeInput,
): Promise<Income> {
  const scope = `POST /households/${householdId}/incomes`
  return withIdempotencyKey(scope, input, (idempotencyKey) =>
    apiFetch<Income>(`/api/v1/households/${householdId}/incomes`, {
      method: 'POST',
      csrf: true,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: input,
    }),
  )
}

export async function voidIncome(
  householdId: string,
  incomeId: string,
  version: number,
  input: VoidIncomeInput,
): Promise<Income> {
  const scope = `POST /households/${householdId}/incomes/${incomeId}/void`
  return withIdempotencyKey(scope, { version, ...input }, (idempotencyKey) =>
    apiFetch<Income>(
      `/api/v1/households/${householdId}/incomes/${incomeId}/void`,
      {
        method: 'POST',
        csrf: true,
        headers: {
          'Idempotency-Key': idempotencyKey,
          'If-Match': versionMatch(version),
        },
        body: input,
      },
    ),
  )
}
