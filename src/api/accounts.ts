import { apiFetch } from '@/api/client'
import { withIdempotencyKey } from '@/lib/idempotency'
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

/**
 * Spring AccountController exposes list, detail, ledger, and create only.
 * There is no PUT update or PATCH status route — do not call them from the client.
 */
export async function listAccounts(householdId: string): Promise<Account[]> {
  return apiFetch<Account[]>(`/api/v1/households/${householdId}/accounts`)
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
  const scope = `POST /households/${householdId}/accounts`
  return withIdempotencyKey(scope, input, (idempotencyKey) =>
    apiFetch<Account>(`/api/v1/households/${householdId}/accounts`, {
      method: 'POST',
      csrf: true,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: input,
    }),
  )
}
