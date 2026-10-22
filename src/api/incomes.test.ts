import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createIncome, voidIncome } from '@/api/incomes'
import { resetAuthClientForTests } from '@/api/client'
import {
  peekIdempotencyRecoveryRecords,
  resetIdempotencyForTests,
  resetIdempotencyMemoryForTests,
  setIdempotencyActor,
} from '@/lib/idempotency'
import { sampleUser } from '@/test/fixtures'

const householdId = '33333333-3333-4333-8333-333333333333'
const incomeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const createInput = {
  effectiveDate: '2026-10-19',
  amount: '400',
  accountId: '44444444-4444-4444-8444-444444444444',
  beneficiaryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  note: 'Salary',
}

const createdIncome = {
  id: incomeId,
  kind: 'INCOME' as const,
  state: 'POSTED',
  effectiveDate: '2026-10-19',
  amount: '400',
  currency: 'MMK',
  note: 'Salary',
  account: { id: createInput.accountId, name: 'Cash', kind: null },
  beneficiary: {
    id: createInput.beneficiaryId,
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
  },
  createdBy: { userId: sampleUser.id, displayName: 'Sample Member' },
  recordedAt: '2026-10-19T10:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canVoid: true },
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function truncatedJsonResponse(): Response {
  return new Response('{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","amount":', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestInit(call: unknown[] | undefined): RequestInit | undefined {
  return call?.[1] as RequestInit | undefined
}

function header(call: unknown[] | undefined, name: string): string | null {
  return new Headers(requestInit(call)?.headers).get(name)
}

function bodyOf(call: unknown[] | undefined): unknown {
  const body = requestInit(call)?.body
  return typeof body === 'string' ? JSON.parse(body) : null
}

describe('income mutations', () => {
  beforeEach(() => {
    resetAuthClientForTests()
    resetIdempotencyForTests()
    setIdempotencyActor(sampleUser.id)
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('income-key-a')
      .mockReturnValueOnce('income-key-b')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    resetIdempotencyForTests()
    resetAuthClientForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends CSRF, exact payload, and an idempotency key on create', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(jsonResponse(createdIncome, { status: 201 }))

    const result = await createIncome(householdId, createInput)
    expect(result).toEqual(createdIncome)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    const write = fetchMock.mock.calls[1]
    expect(write?.[0]).toBe(`/api/v1/households/${householdId}/incomes`)
    expect(header(write, 'X-CSRF-TOKEN')).toBe('csrf-token')
    expect(header(write, 'Idempotency-Key')).toBe('income-key-a')
    expect(bodyOf(write)).toEqual(createInput)
  })

  it('reuses the create key after an ambiguous response and after reload', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(truncatedJsonResponse())
      .mockResolvedValueOnce(jsonResponse(createdIncome, { status: 201 }))

    await expect(createIncome(householdId, createInput)).rejects.toBeInstanceOf(
      SyntaxError,
    )

    const stored = peekIdempotencyRecoveryRecords()
    expect(stored).toHaveLength(1)
    expect(Object.keys(stored[0] ?? {})).toEqual(['k', 'p', 's', 't'])
    expect(JSON.stringify(stored)).not.toContain('Salary')
    expect(JSON.stringify(stored)).not.toContain(sampleUser.id)

    resetIdempotencyMemoryForTests()
    setIdempotencyActor(sampleUser.id)

    const retry = await createIncome(householdId, createInput)
    expect(retry).toEqual(createdIncome)

    const writeCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === `/api/v1/households/${householdId}/incomes`,
    )
    expect(writeCalls).toHaveLength(2)
    expect(header(writeCalls[0], 'Idempotency-Key')).toBe('income-key-a')
    expect(header(writeCalls[1], 'Idempotency-Key')).toBe('income-key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('sends CSRF, quoted If-Match, and a stable void key that includes version', async () => {
    const fetchMock = vi.mocked(fetch)
    const voided = {
      ...createdIncome,
      state: 'VOID',
      capabilities: { canVoid: false },
      version: 1,
    }
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(truncatedJsonResponse())
      .mockResolvedValueOnce(jsonResponse(voided))
      .mockResolvedValueOnce(jsonResponse(voided))

    await expect(
      voidIncome(householdId, incomeId, 0, { reason: 'Entered twice' }),
    ).rejects.toBeInstanceOf(SyntaxError)

    const retry = await voidIncome(householdId, incomeId, 0, {
      reason: 'Entered twice',
    })
    expect(retry).toEqual(voided)

    const nextVersion = await voidIncome(householdId, incomeId, 1, {
      reason: 'Entered twice',
    })
    expect(nextVersion).toEqual(voided)

    const writeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/void'),
    )
    expect(writeCalls).toHaveLength(3)
    expect(header(writeCalls[0], 'X-CSRF-TOKEN')).toBe('csrf-token')
    expect(header(writeCalls[0], 'If-Match')).toBe('"0"')
    expect(header(writeCalls[0], 'Idempotency-Key')).toBe('income-key-a')
    expect(header(writeCalls[1], 'If-Match')).toBe('"0"')
    expect(header(writeCalls[1], 'Idempotency-Key')).toBe('income-key-a')
    expect(header(writeCalls[2], 'If-Match')).toBe('"1"')
    expect(header(writeCalls[2], 'Idempotency-Key')).toBe('income-key-b')
    expect(bodyOf(writeCalls[0])).toEqual({ reason: 'Entered twice' })
    expect(crypto.randomUUID).toHaveBeenCalledTimes(2)
  })
})
