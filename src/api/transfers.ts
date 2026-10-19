import { apiFetch } from '@/api/client'
import { withIdempotencyKey } from '@/lib/idempotency'

export type TransferRef = {
  id: string
  name: string
}

export type TransferActor = {
  userId: string
  displayName: string
}

export type TransferCapabilities = {
  canVoid: boolean
}

export type Transfer = {
  id: string
  kind: string
  state: string
  effectiveDate: string
  amount: string
  currency: string
  note: string | null
  sourceAccount: TransferRef
  destinationAccount: TransferRef
  createdBy: TransferActor
  recordedAt: string
  version: number
  revisionNo: number
  capabilities: TransferCapabilities
}

export type CreateTransferInput = {
  effectiveDate: string
  amount: string
  sourceAccountId: string
  destinationAccountId: string
  note?: string
}

export type VoidTransferInput = {
  reason: string
}

function versionMatch(version: number): string {
  return `"${version}"`
}

export async function listTransfers(householdId: string): Promise<Transfer[]> {
  return apiFetch<Transfer[]>(`/api/v1/households/${householdId}/transfers`)
}

export async function getTransfer(
  householdId: string,
  transferId: string,
): Promise<Transfer> {
  return apiFetch<Transfer>(
    `/api/v1/households/${householdId}/transfers/${transferId}`,
  )
}

export async function createTransfer(
  householdId: string,
  input: CreateTransferInput,
): Promise<Transfer> {
  const scope = `POST /households/${householdId}/transfers`
  return withIdempotencyKey(scope, input, (idempotencyKey) =>
    apiFetch<Transfer>(`/api/v1/households/${householdId}/transfers`, {
      method: 'POST',
      csrf: true,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: input,
    }),
  )
}

export async function voidTransfer(
  householdId: string,
  transferId: string,
  version: number,
  input: VoidTransferInput,
): Promise<Transfer> {
  const scope = `POST /households/${householdId}/transfers/${transferId}/void`
  return withIdempotencyKey(scope, { version, ...input }, (idempotencyKey) =>
    apiFetch<Transfer>(
      `/api/v1/households/${householdId}/transfers/${transferId}/void`,
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
