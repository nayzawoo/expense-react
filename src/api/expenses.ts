import { apiFetch } from '@/api/client'

export type ExpenseRef = {
  id: string
  name: string
  kind: string | null
}

export type ExpenseActor = {
  userId: string
  displayName: string
}

export type ExpenseCapabilities = {
  canReplace: boolean
  canVoid: boolean
}

export type Expense = {
  id: string
  kind: string
  state: string
  effectiveDate: string
  amount: string
  currency: string
  note: string | null
  account: ExpenseRef
  category: ExpenseRef
  beneficiary: ExpenseRef
  createdBy: ExpenseActor
  recordedAt: string
  version: number
  revisionNo: number
  capabilities: ExpenseCapabilities
}

export type CreateExpenseInput = {
  effectiveDate: string
  amount: string
  accountId: string
  categoryId: string
  beneficiaryId: string
  note?: string
}

export type ReplaceExpenseInput = CreateExpenseInput & {
  changeReason: string
}

export type VoidExpenseInput = {
  reason: string
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

function versionMatch(version: number): string {
  return `"${version}"`
}

export async function listExpenses(householdId: string): Promise<Expense[]> {
  return apiFetch<Expense[]>(`/api/v1/households/${householdId}/expenses`)
}

export async function getExpense(
  householdId: string,
  expenseId: string,
): Promise<Expense> {
  return apiFetch<Expense>(
    `/api/v1/households/${householdId}/expenses/${expenseId}`,
  )
}

export async function createExpense(
  householdId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  return apiFetch<Expense>(`/api/v1/households/${householdId}/expenses`, {
    method: 'POST',
    csrf: true,
    headers: {
      'Idempotency-Key': newIdempotencyKey(),
    },
    body: input,
  })
}

export async function replaceExpense(
  householdId: string,
  expenseId: string,
  version: number,
  input: ReplaceExpenseInput,
): Promise<Expense> {
  return apiFetch<Expense>(
    `/api/v1/households/${householdId}/expenses/${expenseId}`,
    {
      method: 'PUT',
      csrf: true,
      headers: {
        'Idempotency-Key': newIdempotencyKey(),
        'If-Match': versionMatch(version),
      },
      body: input,
    },
  )
}

export async function voidExpense(
  householdId: string,
  expenseId: string,
  version: number,
  input: VoidExpenseInput,
): Promise<Expense> {
  return apiFetch<Expense>(
    `/api/v1/households/${householdId}/expenses/${expenseId}/void`,
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
