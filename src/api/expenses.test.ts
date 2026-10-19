import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createExpense } from '@/api/expenses'
import { resetAuthClientForTests } from '@/api/client'
import { resetIdempotencyForTests } from '@/lib/idempotency'

const householdId = '33333333-3333-4333-8333-333333333333'

const createInput = {
  effectiveDate: '2026-10-19',
  amount: '10',
  accountId: '44444444-4444-4444-8444-444444444444',
  categoryId: '66666666-6666-4666-8666-666666666666',
  beneficiaryId: '77777777-7777-4777-8777-777777777777',
}

const createdExpense = {
  id: '99999999-9999-4999-8999-999999999999',
  kind: 'EXPENSE',
  state: 'POSTED',
  effectiveDate: '2026-10-19',
  amount: '10',
  currency: 'MMK',
  note: null,
  account: { id: createInput.accountId, name: 'Cash', kind: 'CASH' },
  category: { id: createInput.categoryId, name: 'Food', kind: null },
  beneficiary: { id: createInput.beneficiaryId, name: 'Store', kind: null },
  createdBy: { userId: '11111111-1111-4111-8111-111111111111', displayName: 'Sample' },
  recordedAt: '2026-10-19T10:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canReplace: true, canVoid: true },
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function truncatedJsonResponse(): Response {
  return new Response('{"id":"99999999-9999-4999-8999-999999999999","amount":', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function idempotencyKeyFromCall(call: unknown[] | undefined): string | null {
  const init = call?.[1] as RequestInit | undefined
  return new Headers(init?.headers).get('Idempotency-Key')
}

describe('createExpense idempotency', () => {
  beforeEach(() => {
    resetAuthClientForTests()
    resetIdempotencyForTests()
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('expense-key-a')
        .mockReturnValueOnce('expense-key-b'),
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    resetIdempotencyForTests()
    resetAuthClientForTests()
    vi.unstubAllGlobals()
  })

  it('reuses the key when a successful POST returns unparseable JSON', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(truncatedJsonResponse())
      .mockResolvedValueOnce(jsonResponse(createdExpense))

    await expect(createExpense(householdId, createInput)).rejects.toBeInstanceOf(
      SyntaxError,
    )

    const retry = await createExpense(householdId, createInput)
    expect(retry).toEqual(createdExpense)

    const writeCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === `/api/v1/households/${householdId}/expenses`,
    )
    expect(writeCalls).toHaveLength(2)
    expect(idempotencyKeyFromCall(writeCalls[0])).toBe('expense-key-a')
    expect(idempotencyKeyFromCall(writeCalls[1])).toBe('expense-key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })
})
