import { apiFetch } from '@/api/client'
import { withIdempotencyKey } from '@/lib/idempotency'

export const ADJUSTMENT_REASON_MAX = 500

export type AdjustmentRef = {
  id: string
  name: string
}

export type AdjustmentActor = {
  userId: string
  displayName: string
}

export type AdjustmentCapabilities = {
  canVoid: boolean
}

export type Adjustment = {
  id: string
  kind: 'ADJUSTMENT'
  state: string
  effectiveDate: string
  amount: string
  currency: string
  reason: string
  balanceBefore: string
  observedBalance: string
  observedBalanceVersion: number
  account: AdjustmentRef
  createdBy: AdjustmentActor
  recordedAt: string
  version: number
  revisionNo: number
  capabilities: AdjustmentCapabilities
}

export type ReconcileAccountInput = {
  actualBalance: string
  expectedBalanceVersion: number
  reason: string
}

export type VoidAdjustmentInput = {
  reason: string
}

function versionMatch(version: number): string {
  return `"${version}"`
}

export async function listAdjustments(
  householdId: string,
): Promise<Adjustment[]> {
  return apiFetch<Adjustment[]>(
    `/api/v1/households/${householdId}/adjustments`,
  )
}

export async function getAdjustment(
  householdId: string,
  adjustmentId: string,
): Promise<Adjustment> {
  return apiFetch<Adjustment>(
    `/api/v1/households/${householdId}/adjustments/${adjustmentId}`,
  )
}

export async function reconcileAccount(
  householdId: string,
  accountId: string,
  input: ReconcileAccountInput,
): Promise<Adjustment> {
  const scope = `POST /households/${householdId}/accounts/${accountId}/reconciliations`
  return withIdempotencyKey(scope, input, (idempotencyKey) =>
    apiFetch<Adjustment>(
      `/api/v1/households/${householdId}/accounts/${accountId}/reconciliations`,
      {
        method: 'POST',
        csrf: true,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: input,
      },
    ),
  )
}

export async function voidAdjustment(
  householdId: string,
  adjustmentId: string,
  version: number,
  input: VoidAdjustmentInput,
): Promise<Adjustment> {
  const scope = `POST /households/${householdId}/adjustments/${adjustmentId}/void`
  return withIdempotencyKey(scope, { version, ...input }, (idempotencyKey) =>
    apiFetch<Adjustment>(
      `/api/v1/households/${householdId}/adjustments/${adjustmentId}/void`,
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
