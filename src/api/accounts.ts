import { apiFetch } from '@/api/client'
import type { Account, AccountStatus, AccountType } from '@/api/types'

export type { Account, AccountStatus, AccountType }

export type CreateAccountInput = {
  name: string
  type: AccountType
  ownerLabel: string
  openedOn: string
  openingAmount: string
  sortOrder: number
}

export type UpdateAccountInput = {
  name: string
  type: AccountType
  ownerLabel: string
  sortOrder: number
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export async function listAccounts(
  householdId: string,
  status: AccountStatus | 'ALL' | '' = 'ALL',
): Promise<Account[]> {
  const query =
    status && status !== 'ALL'
      ? `?status=${encodeURIComponent(status)}`
      : ''
  return apiFetch<Account[]>(
    `/api/v1/households/${householdId}/accounts${query}`,
  )
}

export async function getAccount(
  householdId: string,
  accountId: string,
): Promise<Account> {
  return apiFetch<Account>(
    `/api/v1/households/${householdId}/accounts/${accountId}`,
  )
}

export async function createAccount(
  householdId: string,
  input: CreateAccountInput,
): Promise<Account> {
  return apiFetch<Account>(`/api/v1/households/${householdId}/accounts`, {
    method: 'POST',
    csrf: true,
    headers: {
      'Idempotency-Key': newIdempotencyKey(),
    },
    body: input,
  })
}

export async function updateAccount(
  householdId: string,
  accountId: string,
  input: UpdateAccountInput,
): Promise<Account> {
  return apiFetch<Account>(
    `/api/v1/households/${householdId}/accounts/${accountId}`,
    {
      method: 'PUT',
      csrf: true,
      body: input,
    },
  )
}

export async function updateAccountStatus(
  householdId: string,
  accountId: string,
  status: AccountStatus,
): Promise<Account> {
  return apiFetch<Account>(
    `/api/v1/households/${householdId}/accounts/${accountId}/status`,
    {
      method: 'PATCH',
      csrf: true,
      body: { status },
    },
  )
}
