import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import {
  IdempotencyCapacityError,
  MAX_PENDING_PER_SCOPE,
  clearIdempotencyScope,
  hasIdempotencyScope,
  idempotencyKeyFor,
  isAmbiguousWriteFailure,
  peekIdempotencyScope,
  peekIdempotencyScopeSize,
  resetIdempotencyForTests,
  withIdempotencyKey,
} from '@/lib/idempotency'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

  it('keeps unresolved keys when the payload is edited and then reverted', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b')
        .mockReturnValueOnce('key-c'),
    })

    const original = { amount: '10' }
    const edited = { amount: '11' }

    const first = idempotencyKeyFor('create-expense', original)
    const second = idempotencyKeyFor('create-expense', edited)
    const reverted = idempotencyKeyFor('create-expense', original)

    expect(first).toBe('key-a')
    expect(second).toBe('key-b')
    expect(reverted).toBe('key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(2)
    expect(peekIdempotencyScope('create-expense', original)?.key).toBe('key-a')
    expect(peekIdempotencyScope('create-expense', edited)?.key).toBe('key-b')
  })

  it('does not let one overlapping attempt delete another pending key', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b'),
    })

    const original = { amount: '10' }
    const edited = { amount: '11' }
    const first = createDeferred<string>()
    const second = createDeferred<string>()

    const firstRun = withIdempotencyKey(
      'create-expense',
      original,
      async (key) => {
        expect(key).toBe('key-a')
        return first.promise
      },
    )
    const secondRun = withIdempotencyKey(
      'create-expense',
      edited,
      async (key) => {
        expect(key).toBe('key-b')
        return second.promise
      },
    )

    first.resolve('ok-10')
    await expect(firstRun).resolves.toBe('ok-10')

    expect(peekIdempotencyScope('create-expense', original)).toBeUndefined()
    expect(peekIdempotencyScope('create-expense', edited)?.key).toBe('key-b')

    second.resolve('ok-11')
    await expect(secondRun).resolves.toBe('ok-11')
    expect(peekIdempotencyScope('create-expense', edited)).toBeUndefined()
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

    expect(peekIdempotencyScope('create-transfer', { amount: '5' })?.key).toBe(
      'stable-key',
    )

    const seen: string[] = []
    await withIdempotencyKey('create-transfer', { amount: '5' }, async (key) => {
      seen.push(key)
      return 'ok'
    })

    expect(seen).toEqual(['stable-key'])
    expect(peekIdempotencyScope('create-transfer', { amount: '5' })).toBeUndefined()
  })

  it('keeps the key after a response-body parse failure', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('parse-key'),
    })

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      }),
    ).rejects.toBeInstanceOf(SyntaxError)

    expect(peekIdempotencyScope('create-expense', { amount: '10' })?.key).toBe(
      'parse-key',
    )
    expect(isAmbiguousWriteFailure(new SyntaxError('Unexpected end of JSON input'))).toBe(
      true,
    )
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

    expect(peekIdempotencyScope('create-account', { name: 'Cash' })).toBeUndefined()

    const next = idempotencyKeyFor('create-account', { name: 'Cash' })
    expect(next).toBe('key-b')
    clearIdempotencyScope('create-account')
  })

  it('does not let an older same-payload attempt delete a newer key', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('key-a')
        .mockReturnValueOnce('key-b'),
    })

    const payload = { amount: '10' }
    const first = createDeferred<string>()
    const second = createDeferred<string>()
    const replacement = createDeferred<string>()

    const firstRun = withIdempotencyKey(
      'create-expense',
      payload,
      async (key) => {
        expect(key).toBe('key-a')
        return first.promise
      },
    )
    const secondRun = withIdempotencyKey(
      'create-expense',
      payload,
      async (key) => {
        expect(key).toBe('key-a')
        return second.promise
      },
    )

    first.resolve('ok-first')
    await expect(firstRun).resolves.toBe('ok-first')
    expect(peekIdempotencyScope('create-expense', payload)).toBeUndefined()

    const replacementRun = withIdempotencyKey(
      'create-expense',
      payload,
      async (key) => {
        expect(key).toBe('key-b')
        return replacement.promise
      },
    )
    expect(peekIdempotencyScope('create-expense', payload)?.key).toBe('key-b')

    second.resolve('ok-stale')
    await expect(secondRun).resolves.toBe('ok-stale')
    expect(peekIdempotencyScope('create-expense', payload)?.key).toBe('key-b')

    replacement.resolve('ok-new')
    await expect(replacementRun).resolves.toBe('ok-new')
    expect(peekIdempotencyScope('create-expense', payload)).toBeUndefined()
  })

  it('clears using the fingerprint captured at entry if the payload is mutated', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('key-a'),
    })

    const payload = { amount: '10' }
    const started = { amount: '10' }

    await withIdempotencyKey('create-expense', payload, async () => {
      payload.amount = '11'
      return 'ok'
    })

    expect(peekIdempotencyScope('create-expense', started)).toBeUndefined()
    expect(hasIdempotencyScope('create-expense')).toBe(false)
  })

  it('rejects a new payload at capacity without invoking the write or leaking a map', async () => {
    let issued = 0
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `key-${issued++}`),
    })

    for (let index = 0; index < MAX_PENDING_PER_SCOPE; index += 1) {
      idempotencyKeyFor('create-expense', { amount: String(index) })
    }
    expect(peekIdempotencyScopeSize('create-expense')).toBe(MAX_PENDING_PER_SCOPE)

    const run = vi.fn(async () => 'should-not-run')
    await expect(
      withIdempotencyKey('create-expense', { amount: 'new' }, run),
    ).rejects.toBeInstanceOf(IdempotencyCapacityError)

    expect(run).not.toHaveBeenCalled()
    expect(peekIdempotencyScope('create-expense', { amount: 'new' })).toBeUndefined()
    expect(peekIdempotencyScopeSize('create-expense')).toBe(MAX_PENDING_PER_SCOPE)
    expect(hasIdempotencyScope('create-expense')).toBe(true)
    expect(hasIdempotencyScope('unused-scope')).toBe(false)
  })

  it('retries a retained entry when the scope is already at capacity', async () => {
    let issued = 0
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `key-${issued++}`),
    })

    const retained = { amount: '0' }
    for (let index = 0; index < MAX_PENDING_PER_SCOPE; index += 1) {
      idempotencyKeyFor('create-expense', { amount: String(index) })
    }

    const seen: string[] = []
    await withIdempotencyKey('create-expense', retained, async (key) => {
      seen.push(key)
      return 'retried'
    })

    expect(seen).toEqual(['key-0'])
    expect(peekIdempotencyScope('create-expense', retained)).toBeUndefined()
    expect(peekIdempotencyScopeSize('create-expense')).toBe(
      MAX_PENDING_PER_SCOPE - 1,
    )
    expect(crypto.randomUUID).toHaveBeenCalledTimes(MAX_PENDING_PER_SCOPE)
  })
})
