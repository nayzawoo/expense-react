import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import {
  clearIdempotencyScope,
  idempotencyKeyFor,
  peekIdempotencyScope,
  resetIdempotencyForTests,
  withIdempotencyKey,
} from '@/lib/idempotency'

describe('idempotency helpers', () => {
  afterEach(() => {
    resetIdempotencyForTests()
    vi.unstubAllGlobals()
  })

  it('reuses the same key for the same scope and payload', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b'),
    })

    const first = idempotencyKeyFor('create-expense', { amount: '10' })
    const second = idempotencyKeyFor('create-expense', { amount: '10' })

    expect(first).toBe('key-a')
    expect(second).toBe('key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('mints a new key when the payload changes for the same scope', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b'),
    })

    const first = idempotencyKeyFor('create-expense', { amount: '10' })
    const second = idempotencyKeyFor('create-expense', { amount: '11' })

    expect(first).toBe('key-a')
    expect(second).toBe('key-b')
    expect(peekIdempotencyScope('create-expense')?.key).toBe('key-b')
  })

  it('keeps the key after an ambiguous network failure and reuses it', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('stable-key'),
    })

    await expect(
      withIdempotencyKey('create-transfer', { amount: '5' }, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)

    expect(peekIdempotencyScope('create-transfer')?.key).toBe('stable-key')

    const seen: string[] = []
    await withIdempotencyKey('create-transfer', { amount: '5' }, async (key) => {
      seen.push(key)
      return 'ok'
    })

    expect(seen).toEqual(['stable-key'])
    expect(peekIdempotencyScope('create-transfer')).toBeUndefined()
  })

  it('clears the key after a definitive client/server validation failure', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b'),
    })

    await expect(
      withIdempotencyKey('create-account', { name: 'Cash' }, async () => {
        throw new ApiError(400, 'Invalid', 'INVALID')
      }),
    ).rejects.toMatchObject({ status: 400 })

    expect(peekIdempotencyScope('create-account')).toBeUndefined()

    const next = idempotencyKeyFor('create-account', { name: 'Cash' })
    expect(next).toBe('key-b')
    clearIdempotencyScope('create-account')
  })
})
