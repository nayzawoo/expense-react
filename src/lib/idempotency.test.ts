import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceAuthGeneration } from '@/api/client'
import { ApiError } from '@/api/errors'
import {
  IDEMPOTENCY_RECOVERY_TTL_MS,
  IDEMPOTENCY_STORAGE_KEY,
  IdempotencyCapacityError,
  IdempotencyStorageError,
  MAX_PENDING_PER_SCOPE,
  clearIdempotencyScope,
  digestIdempotencyText,
  fingerprintIdempotencyPayload,
  hasIdempotencyScope,
  idempotencyKeyFor,
  isAmbiguousWriteFailure,
  peekIdempotencyRecoveryRecords,
  peekIdempotencyScope,
  peekIdempotencyScopeSize,
  resetIdempotencyForTests,
  resetIdempotencyMemoryForTests,
  getIdempotencyActor,
  setIdempotencyActor,
  withIdempotencyKey,
} from '@/lib/idempotency'

const ACTOR_A = '11111111-1111-4111-8111-111111111111'
const ACTOR_B = '22222222-2222-4222-8222-222222222222'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function stubUuid(...keys: string[]) {
  const spy = vi.spyOn(crypto, 'randomUUID')
  for (const key of keys) {
    spy.mockReturnValueOnce(key)
  }
  return spy
}

function gateDigests() {
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle)
  const gate = createDeferred<void>()
  const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (algo, data) => {
    await gate.promise
    return originalDigest(algo, data)
  })
  return {
    release: () => gate.resolve(),
    spy,
  }
}

describe('idempotency helpers', () => {
  beforeEach(() => {
    setIdempotencyActor(ACTOR_A)
  })

  afterEach(() => {
    resetIdempotencyForTests()
    vi.restoreAllMocks()
  })

  it('reuses the same key for the same scope and payload', () => {
    stubUuid('key-a', 'key-b')

    const first = idempotencyKeyFor('create-expense', { amount: '10' })
    const second = idempotencyKeyFor('create-expense', { amount: '10' })

    expect(first).toBe('key-a')
    expect(second).toBe('key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('keeps unresolved keys when the payload is edited and then reverted', () => {
    stubUuid('key-a', 'key-b', 'key-c')

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
    stubUuid('key-a', 'key-b')

    const original = { amount: '10' }
    const edited = { amount: '11' }
    const first = createDeferred<string>()
    const second = createDeferred<string>()
    const seen: string[] = []

    const firstRun = withIdempotencyKey(
      'create-expense',
      original,
      async (key) => {
        seen.push(`original:${key}`)
        return first.promise
      },
    )
    const secondRun = withIdempotencyKey(
      'create-expense',
      edited,
      async (key) => {
        seen.push(`edited:${key}`)
        return second.promise
      },
    )

    await vi.waitFor(() => {
      expect(peekIdempotencyScope('create-expense', original)?.key).toBeTruthy()
      expect(peekIdempotencyScope('create-expense', edited)?.key).toBeTruthy()
    })

    const originalKey = peekIdempotencyScope('create-expense', original)?.key
    const editedKey = peekIdempotencyScope('create-expense', edited)?.key
    expect(originalKey).not.toBe(editedKey)

    first.resolve('ok-10')
    await expect(firstRun).resolves.toBe('ok-10')

    expect(peekIdempotencyScope('create-expense', original)).toBeUndefined()
    expect(peekIdempotencyScope('create-expense', edited)?.key).toBe(editedKey)

    second.resolve('ok-11')
    await expect(secondRun).resolves.toBe('ok-11')
    expect(peekIdempotencyScope('create-expense', edited)).toBeUndefined()
    expect(seen).toHaveLength(2)
  })

  it('keeps the key after an ambiguous network failure and reuses it', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('stable-key')

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
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('parse-key')

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

  it('keeps the key after a retry conflict', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('conflict-key')

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, async () => {
        throw new ApiError(409, 'Conflict', 'IDEMPOTENCY_KEY_REUSED')
      }),
    ).rejects.toMatchObject({ status: 409 })

    expect(peekIdempotencyScope('create-expense', { amount: '10' })?.key).toBe(
      'conflict-key',
    )
    expect(isAmbiguousWriteFailure(new ApiError(409, 'Conflict'))).toBe(true)
  })

  it('clears the key after a definitive client/server validation failure', async () => {
    stubUuid('key-a', 'key-b')

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
    stubUuid('key-a', 'key-b')

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

    await vi.waitFor(() => {
      expect(peekIdempotencyScope('create-expense', payload)?.key).toBe('key-a')
    })

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
    await vi.waitFor(() => {
      expect(peekIdempotencyScope('create-expense', payload)?.key).toBe('key-b')
    })

    second.resolve('ok-stale')
    await expect(secondRun).resolves.toBe('ok-stale')
    expect(peekIdempotencyScope('create-expense', payload)?.key).toBe('key-b')
    expect(peekIdempotencyRecoveryRecords()).toHaveLength(1)
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-b')

    replacement.resolve('ok-new')
    await expect(replacementRun).resolves.toBe('ok-new')
    expect(peekIdempotencyScope('create-expense', payload)).toBeUndefined()
  })

  it('clears using the fingerprint captured at entry if the payload is mutated', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('key-a')

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
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `key-${issued++}`)

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
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `key-${issued++}`)

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

  it('recovers the same key from storage after a simulated module reload', async () => {
    stubUuid('key-a', 'key-b')
    const payload = { amount: '10', note: 'Groceries' }

    await expect(
      withIdempotencyKey('create-expense', payload, async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      }),
    ).rejects.toBeInstanceOf(SyntaxError)

    const stored = peekIdempotencyRecoveryRecords()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toEqual({
      k: 'key-a',
      p: expect.stringMatching(/^[a-f0-9]{64}$/),
      s: expect.stringMatching(/^[a-f0-9]{64}$/),
      t: expect.any(Number),
    })
    expect(Object.keys(stored[0] ?? {})).toEqual(['k', 'p', 's', 't'])
    expect(JSON.stringify(stored)).not.toContain('Groceries')
    expect(JSON.stringify(stored)).not.toContain(ACTOR_A)
    expect(JSON.stringify(stored)).not.toContain('password')

    resetIdempotencyMemoryForTests()
    expect(peekIdempotencyScope('create-expense', payload)).toBeUndefined()

    const seen: string[] = []
    await withIdempotencyKey('create-expense', payload, async (key) => {
      seen.push(key)
      return 'recovered'
    })
    expect(seen).toEqual(['key-a'])
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('keeps edited and reverted payloads independent across reload', async () => {
    stubUuid('key-a', 'key-b', 'key-c')
    const original = { amount: '10' }
    const edited = { amount: '11' }

    await expect(
      withIdempotencyKey('create-expense', original, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)
    await expect(
      withIdempotencyKey('create-expense', edited, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)

    resetIdempotencyMemoryForTests()
    const seen: string[] = []
    await expect(
      withIdempotencyKey('create-expense', original, async (key) => {
        seen.push(key)
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)
    expect(seen).toEqual(['key-a'])
    expect(peekIdempotencyRecoveryRecords().map((record) => record.k).sort()).toEqual([
      'key-a',
      'key-b',
    ])
  })

  it('does not reuse another actor or household recovery record', async () => {
    stubUuid('key-a', 'key-b', 'key-c')
    const payload = { amount: '10' }

    await expect(
      withIdempotencyKey('POST /households/hh-1/expenses', payload, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)

    setIdempotencyActor(ACTOR_B)
    const otherActor: string[] = []
    await expect(
      withIdempotencyKey('POST /households/hh-1/expenses', payload, async (key) => {
        otherActor.push(key)
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)
    expect(otherActor).toEqual(['key-b'])

    setIdempotencyActor(ACTOR_A)
    const otherHousehold: string[] = []
    await expect(
      withIdempotencyKey('POST /households/hh-2/expenses', payload, async (key) => {
        otherHousehold.push(key)
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)
    expect(otherHousehold).toEqual(['key-c'])

    resetIdempotencyMemoryForTests()
    const original: string[] = []
    await withIdempotencyKey(
      'POST /households/hh-1/expenses',
      payload,
      async (key) => {
        original.push(key)
        return 'ok'
      },
    )
    expect(original).toEqual(['key-a'])
  })

  it('refuses a new write when recovery storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const run = vi.fn(async () => 'nope')

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, run),
    ).rejects.toMatchObject({ name: 'IdempotencyStorageError', reason: 'blocked' })
    expect(run).not.toHaveBeenCalled()
  })

  it('refuses a new write when recovery storage is full', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const run = vi.fn(async () => 'nope')

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, run),
    ).rejects.toBeInstanceOf(IdempotencyStorageError)
    expect(run).not.toHaveBeenCalled()
    expect(peekIdempotencyScope('create-expense', { amount: '10' })).toBeUndefined()
  })

  it('refuses a new write when recovery storage is corrupt', async () => {
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, '{not-json')
    const run = vi.fn(async () => 'nope')

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, run),
    ).rejects.toMatchObject({ name: 'IdempotencyStorageError', reason: 'corrupt' })
    expect(run).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY)).toBe('{not-json')
  })

  it('refuses an expired recovery record instead of minting a new key', async () => {
    stubUuid('key-a', 'key-b')
    const payload = { amount: '10' }
    const fingerprint = fingerprintIdempotencyPayload(payload)
    const payloadDigest = await digestIdempotencyText(fingerprint)
    const partitionDigest = await digestIdempotencyText(
      `${ACTOR_A}\0create-expense`,
    )
    sessionStorage.setItem(
      IDEMPOTENCY_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        records: [
          {
            k: 'key-a',
            p: payloadDigest,
            s: partitionDigest,
            t: Date.now() - IDEMPOTENCY_RECOVERY_TTL_MS - 1,
          },
        ],
      }),
    )

    const run = vi.fn(async () => 'nope')
    await expect(
      withIdempotencyKey('create-expense', payload, run),
    ).rejects.toMatchObject({ name: 'IdempotencyStorageError', reason: 'stale' })
    expect(run).not.toHaveBeenCalled()
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-a')
    expect(crypto.randomUUID).not.toHaveBeenCalled()
  })

  it('refuses an empty recovery store instead of treating it as missing', async () => {
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, '')
    const run = vi.fn(async () => 'nope')

    await expect(
      withIdempotencyKey('create-expense', { amount: '10' }, run),
    ).rejects.toMatchObject({ name: 'IdempotencyStorageError', reason: 'corrupt' })
    expect(run).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY)).toBe('')
  })

  it('refuses duplicate partition and payload records instead of minting a key', async () => {
    stubUuid('key-fresh')
    const payload = { amount: '10' }
    const fingerprint = fingerprintIdempotencyPayload(payload)
    const payloadDigest = await digestIdempotencyText(fingerprint)
    const partitionDigest = await digestIdempotencyText(
      `${ACTOR_A}\0create-expense`,
    )
    const raw = JSON.stringify({
      v: 1,
      records: [
        { k: 'key-a', p: payloadDigest, s: partitionDigest, t: Date.now() },
        { k: 'key-b', p: payloadDigest, s: partitionDigest, t: Date.now() },
      ],
    })
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, raw)
    const run = vi.fn(async () => 'nope')

    await expect(
      withIdempotencyKey('create-expense', payload, run),
    ).rejects.toMatchObject({ name: 'IdempotencyStorageError', reason: 'corrupt' })
    expect(run).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY)).toBe(raw)
    expect(crypto.randomUUID).not.toHaveBeenCalled()
  })

  it('does not run a write after an actor switch during digest', async () => {
    stubUuid('key-a', 'key-b')
    const payload = { amount: '10' }
    await expect(
      withIdempotencyKey('create-expense', payload, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-a')

    resetIdempotencyMemoryForTests()
    const { release } = gateDigests()
    const run = vi.fn(async () => 'nope')
    const pending = withIdempotencyKey('create-expense', payload, run)

    await vi.waitFor(() => {
      expect(crypto.subtle.digest).toHaveBeenCalled()
    })
    setIdempotencyActor(ACTOR_B)
    release()

    await expect(pending).rejects.toMatchObject({
      name: 'IdempotencyStorageError',
      reason: 'superseded',
    })
    expect(run).not.toHaveBeenCalled()
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('does not run a write after a same-actor generation change during digest', async () => {
    stubUuid('key-a', 'key-b')
    const payload = { amount: '10' }
    await expect(
      withIdempotencyKey('create-expense', payload, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(TypeError)

    resetIdempotencyMemoryForTests()
    const { release } = gateDigests()
    const run = vi.fn(async () => 'nope')
    const pending = withIdempotencyKey('create-expense', payload, run)

    await vi.waitFor(() => {
      expect(crypto.subtle.digest).toHaveBeenCalled()
    })
    advanceAuthGeneration()
    release()

    await expect(pending).rejects.toMatchObject({
      name: 'IdempotencyStorageError',
      reason: 'superseded',
    })
    expect(run).not.toHaveBeenCalled()
    expect(getIdempotencyActor()).toBe(ACTOR_A)
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-a')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('leaves a recovery record when cleanup fails after a successful write', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('key-a')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const payload = { amount: '10' }

    await withIdempotencyKey('create-expense', payload, async () => {
      setItem.mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      return 'committed'
    })

    expect(peekIdempotencyScope('create-expense', payload)).toBeUndefined()
    expect(peekIdempotencyRecoveryRecords()[0]?.k).toBe('key-a')
  })
})
