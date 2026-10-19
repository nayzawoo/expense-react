import { apiFetch } from '@/api/client'

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

function newIdempotencyKey(): string {
  return crypto.randomUUID()
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
  return apiFetch<Transfer>(`/api/v1/households/${householdId}/transfers`, {
    method: 'POST',
    csrf: true,
    headers: {
      'Idempotency-Key': newIdempotencyKey(),
    },
    body: input,
  })
}

export async function voidTransfer(
  householdId: string,
  transferId: string,
  version: number,
  input: VoidTransferInput,
): Promise<Transfer> {
  return apiFetch<Transfer>(
    `/api/v1/households/${householdId}/transfers/${transferId}/void`,
    {
      method: 'POST',
      csrf: true,
      headers: {
        'Idempotency-Key': newIdempotencyKey(),
        'If-Match': versionMatch(version),
      },
      body: input,
    },
  )
}
