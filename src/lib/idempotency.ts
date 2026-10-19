/**
 * Stable Idempotency-Key helper for Spring financial writes.
 *
 * - Same scope + same payload → reuse the pending key (safe retry after a lost response).
 * - Same scope + changed payload → mint a new key (never reuse a key with a different body).
 * - clearIdempotencyScope on definitive success or client validation failure.
 * - Keep the pending key on ambiguous outcomes (network errors, 5xx) so a retry is safe.
 */

type Pending = {
  key: string
  payloadHash: string
}

const pendingByScope = new Map<string, Pending>()

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

export function hashIdempotencyPayload(payload: unknown): string {
  return stableStringify(payload)
}

export function idempotencyKeyFor(
  scope: string,
  payload: unknown,
): string {
  const payloadHash = hashIdempotencyPayload(payload)
  const existing = pendingByScope.get(scope)
  if (existing && existing.payloadHash === payloadHash) {
    return existing.key
  }
  const key = crypto.randomUUID()
  pendingByScope.set(scope, { key, payloadHash })
  return key
}

export function clearIdempotencyScope(scope: string): void {
  pendingByScope.delete(scope)
}

/** Test helper — not for production call sites. */
export function peekIdempotencyScope(scope: string): Pending | undefined {
  return pendingByScope.get(scope)
}

export function resetIdempotencyForTests(): void {
  pendingByScope.clear()
}

export function isAmbiguousWriteFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status
    return status >= 500 || status === 408 || status === 429
  }
  return false
}

export async function withIdempotencyKey<T>(
  scope: string,
  payload: unknown,
  run: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  const key = idempotencyKeyFor(scope, payload)
  try {
    const result = await run(key)
    clearIdempotencyScope(scope)
    return result
  } catch (error) {
    if (!isAmbiguousWriteFailure(error)) {
      clearIdempotencyScope(scope)
    }
    throw error
  }
}
