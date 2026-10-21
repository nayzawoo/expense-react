import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  reconcileAccount,
  voidAdjustment,
} from '@/api/adjustments'
import { resetAuthClientForTests } from '@/api/client'
import {
  peekIdempotencyRecoveryRecords,
  resetIdempotencyForTests,
  resetIdempotencyMemoryForTests,
  setIdempotencyActor,
} from '@/lib/idempotency'
import { sampleAdjustment, sampleAdmin, sampleHousehold } from '@/test/fixtures'

const householdId = sampleHousehold.id
const accountId = sampleAdjustment.account.id

const reconcileInput = {
  actualBalance: '1200',
  expectedBalanceVersion: 2,
  reason: 'Counted cash drawer',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function truncatedJsonResponse(): Response {
  return new Response('{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","amount":', {
    status: 201,
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

describe('adjustment mutations', () => {
  beforeEach(() => {
    resetAuthClientForTests()
    resetIdempotencyForTests()
    setIdempotencyActor(sampleAdmin.id)
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('adjust-key-a')
      .mockReturnValueOnce('adjust-key-b')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    resetIdempotencyForTests()
    resetAuthClientForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends CSRF, exact payload, and an idempotency key on reconcile', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(jsonResponse(sampleAdjustment, { status: 201 }))

    const result = await reconcileAccount(householdId, accountId, reconcileInput)
    expect(result).toEqual(sampleAdjustment)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    const write = fetchMock.mock.calls[1]
    expect(write?.[0]).toBe(
      `/api/v1/households/${householdId}/accounts/${accountId}/reconciliations`,
    )
    expect(header(write, 'X-CSRF-TOKEN')).toBe('csrf-token')
    expect(header(write, 'Idempotency-Key')).toBe('adjust-key-a')
    expect(bodyOf(write)).toEqual(reconcileInput)
    expect(bodyOf(write)).not.toHaveProperty('effectiveDate')
  })

  it('reuses the reconcile key after an ambiguous response and after reload', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
      )
      .mockResolvedValueOnce(truncatedJsonResponse())
      .mockResolvedValueOnce(jsonResponse(sampleAdjustment, { status: 201 }))

    await expect(
      reconcileAccount(householdId, accountId, reconcileInput),
    ).rejects.toBeInstanceOf(SyntaxError)

    const stored = peekIdempotencyRecoveryRecords()
    expect(stored).toHaveLength(1)
    expect(JSON.stringify(stored)).not.toContain('Counted cash drawer')
    expect(JSON.stringify(stored)).not.toContain(sampleAdmin.id)

    resetIdempotencyMemoryForTests()
    setIdempotencyActor(sampleAdmin.id)

    const retry = await reconcileAccount(householdId, accountId, reconcileInput)
    expect(retry).toEqual(sampleAdjustment)

    const writeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/reconciliations'),
    )
    expect(header(writeCalls[0], 'Idempotency-Key')).toBe('adjust-key-a')
    expect(header(writeCalls[1], 'Idempotency-Key')).toBe('adjust-key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('sends CSRF, quoted If-Match, and a stable void idempotency key', async () => {
    const fetchMock = vi.mocked(fetch)
    const voided = {
      ...sampleAdjustment,
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

    await expect(
      voidAdjustment(householdId, sampleAdjustment.id, 0, {
        reason: 'Entered twice',
      }),
    ).rejects.toBeInstanceOf(SyntaxError)

    const retry = await voidAdjustment(householdId, sampleAdjustment.id, 0, {
      reason: 'Entered twice',
    })
    expect(retry).toEqual(voided)

    const writeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/void'),
    )
    expect(writeCalls).toHaveLength(2)
    expect(header(writeCalls[0], 'X-CSRF-TOKEN')).toBe('csrf-token')
    expect(header(writeCalls[0], 'If-Match')).toBe('"0"')
    expect(header(writeCalls[0], 'Idempotency-Key')).toBe('adjust-key-a')
    expect(header(writeCalls[1], 'Idempotency-Key')).toBe('adjust-key-a')
    expect(bodyOf(writeCalls[0])).toEqual({ reason: 'Entered twice' })
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })
})
