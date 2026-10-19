/**
 * Stable Idempotency-Key helper for Spring financial writes.
 *
 * - Same scope + same payload fingerprint → reuse the pending key (safe retry).
 * - Same scope + changed payload → mint a new key and keep any unresolved siblings.
 * - Clear an entry only when it still holds the key captured at attempt start.
 * - Keep pending keys on ambiguous outcomes (network, 5xx, parse failures, unknown).
 * - Fingerprints are canonical JSON serializations, not cryptographic hashes.
 * - Cap unresolved entries per scope; never evict a retained key to make room.
 */

export const MAX_PENDING_PER_SCOPE = 16

type Pending = {
  key: string
  fingerprint: string
}

const pendingByScope = new Map<string, Map<string, Pending>>()

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

/** Canonical serialization used to match logical submissions. Not a hash. */
export function fingerprintIdempotencyPayload(payload: unknown): string {
  return stableStringify(payload)
}

export class IdempotencyCapacityError extends Error {
  readonly scope: string

  constructor(scope: string) {
    super('Too many unresolved submissions for this action')
    this.name = 'IdempotencyCapacityError'
    this.scope = scope
  }
}

function reserveIdempotencyKey(scope: string, fingerprint: string): string {
  const existingEntries = pendingByScope.get(scope)
  const existing = existingEntries?.get(fingerprint)
  if (existing) {
    return existing.key
  }

  if ((existingEntries?.size ?? 0) >= MAX_PENDING_PER_SCOPE) {
    throw new IdempotencyCapacityError(scope)
  }

  const key = crypto.randomUUID()
  const entries = existingEntries ?? new Map<string, Pending>()
  if (!existingEntries) {
    pendingByScope.set(scope, entries)
  }
  entries.set(fingerprint, { key, fingerprint })
  return key
}

export function idempotencyKeyFor(scope: string, payload: unknown): string {
  return reserveIdempotencyKey(scope, fingerprintIdempotencyPayload(payload))
}

export function clearIdempotencyScope(scope: string): void {
  pendingByScope.delete(scope)
}

function clearIfCurrentKey(
  scope: string,
  fingerprint: string,
  key: string,
): void {
  const entries = pendingByScope.get(scope)
  const current = entries?.get(fingerprint)
  if (!entries || !current || current.key !== key) {
    return
  }
  entries.delete(fingerprint)
  if (entries.size === 0) {
    pendingByScope.delete(scope)
  }
}

/** Test helper — not for production call sites. */
export function peekIdempotencyScope(
  scope: string,
  payload: unknown,
): Pending | undefined {
  return pendingByScope
    .get(scope)
    ?.get(fingerprintIdempotencyPayload(payload))
}

/** Test helper — not for production call sites. */
export function peekIdempotencyScopeSize(scope: string): number {
  return pendingByScope.get(scope)?.size ?? 0
}

/** Test helper — true only when a scope map exists, including empty leaks. */
export function hasIdempotencyScope(scope: string): boolean {
  return pendingByScope.has(scope)
}

export function resetIdempotencyForTests(): void {
  pendingByScope.clear()
}

/**
 * A write is ambiguous unless the server confirmed it did not commit.
 * 4xx except 408/429 are treated as confirmed rejection. Everything else
 * (network, parse, 5xx, unknown) must keep the pending key.
 */
export function isAmbiguousWriteFailure(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status
    if (status >= 500 || status === 408 || status === 429) {
      return true
    }
    if (status >= 400 && status < 500) {
      return false
    }
  }
  return true
}

export async function withIdempotencyKey<T>(
  scope: string,
  payload: unknown,
  run: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  const fingerprint = fingerprintIdempotencyPayload(payload)
  const key = reserveIdempotencyKey(scope, fingerprint)
  try {
    const result = await run(key)
    clearIfCurrentKey(scope, fingerprint, key)
    return result
  } catch (error) {
    if (!isAmbiguousWriteFailure(error)) {
      clearIfCurrentKey(scope, fingerprint, key)
    }
    throw error
  }
}
