/**
 * Stable Idempotency-Key helper for Spring financial writes.
 *
 * - Same actor + scope + payload digest → reuse the pending key (safe retry).
 * - Changed payloads stay independent. Cleanup requires the exact reserved key.
 * - Canonical JSON is only an in-memory matcher and is never persisted.
 * - sessionStorage keeps opaque keys plus SHA-256 digests for same-tab reload.
 * - Cap unresolved entries per actor/scope; never evict a retained key.
 */

import { getAuthGeneration } from '@/api/client'
import {
  countPartitionRecords,
  findRecoveryRecord,
  IDEMPOTENCY_STORAGE_KEY,
  IdempotencyStorageError,
  isRecoveryRecordExpired,
  readRecoveryStore,
  removeMatchingRecoveryRecord,
  upsertRecoveryRecord,
  writeRecoveryStore,
  type RecoveryRecord,
} from '@/lib/idempotency-storage'

export {
  IdempotencyStorageError,
  IDEMPOTENCY_RECOVERY_TTL_MS,
  IDEMPOTENCY_STORAGE_KEY,
} from '@/lib/idempotency-storage'

export const MAX_PENDING_PER_SCOPE = 16

type Pending = {
  key: string
  fingerprint: string
}

type Reservation = {
  actorId: string
  generation: number
  scope: string
  memoryPartition: string
  partitionDigest: string
  fingerprint: string
  payloadDigest: string
  key: string
}

const pendingByPartition = new Map<string, Map<string, Pending>>()
let currentActorId: string | null = null

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

/** Canonical serialization used to match in-memory submissions. Not a digest. */
export function fingerprintIdempotencyPayload(payload: unknown): string {
  return stableStringify(payload)
}

export async function digestIdempotencyText(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new IdempotencyStorageError(
      'unavailable',
      'Retry recovery digest is not available',
    )
  }
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function setIdempotencyActor(actorId: string | null): void {
  currentActorId = actorId
}

export function getIdempotencyActor(): string | null {
  return currentActorId
}

function requireActor(): string {
  if (!currentActorId) {
    throw new IdempotencyStorageError(
      'missing-actor',
      'Retry recovery requires a signed-in member',
    )
  }
  return currentActorId
}

function assertCurrentAttempt(actorId: string, generation: number): void {
  if (
    getIdempotencyActor() !== actorId ||
    getAuthGeneration() !== generation
  ) {
    throw new IdempotencyStorageError(
      'superseded',
      'Retry recovery was superseded by a later sign-in',
    )
  }
}

function memoryPartitionFor(actorId: string, scope: string): string {
  return `${actorId}\n${scope}`
}

export class IdempotencyCapacityError extends Error {
  readonly scope: string

  constructor(scope: string) {
    super('Too many unresolved submissions for this action')
    this.name = 'IdempotencyCapacityError'
    this.scope = scope
  }
}

function memoryEntries(memoryPartition: string): Map<string, Pending> | undefined {
  return pendingByPartition.get(memoryPartition)
}

function rememberPending(
  memoryPartition: string,
  fingerprint: string,
  key: string,
): void {
  let entries = pendingByPartition.get(memoryPartition)
  if (!entries) {
    entries = new Map()
    pendingByPartition.set(memoryPartition, entries)
  }
  entries.set(fingerprint, { key, fingerprint })
}

function reserveInMemory(scope: string, fingerprint: string): string {
  const actorId = requireActor()
  const memoryPartition = memoryPartitionFor(actorId, scope)
  const existingEntries = memoryEntries(memoryPartition)
  const existing = existingEntries?.get(fingerprint)
  if (existing) {
    return existing.key
  }
  if ((existingEntries?.size ?? 0) >= MAX_PENDING_PER_SCOPE) {
    throw new IdempotencyCapacityError(scope)
  }
  const key = crypto.randomUUID()
  rememberPending(memoryPartition, fingerprint, key)
  return key
}

export function idempotencyKeyFor(scope: string, payload: unknown): string {
  return reserveInMemory(scope, fingerprintIdempotencyPayload(payload))
}

export function clearIdempotencyScope(scope: string): void {
  if (!currentActorId) {
    return
  }
  pendingByPartition.delete(memoryPartitionFor(currentActorId, scope))
}

function clearMemoryIfCurrent(reservation: Reservation): void {
  const entries = memoryEntries(reservation.memoryPartition)
  const current = entries?.get(reservation.fingerprint)
  if (!entries || !current || current.key !== reservation.key) {
    return
  }
  entries.delete(reservation.fingerprint)
  if (entries.size === 0) {
    pendingByPartition.delete(reservation.memoryPartition)
  }
}

function persistReservation(reservation: Reservation, createdAt: number): void {
  const store = readRecoveryStore()
  const existing = findRecoveryRecord(
    store,
    reservation.partitionDigest,
    reservation.payloadDigest,
  )
  if (existing) {
    if (existing.k !== reservation.key) {
      throw new IdempotencyStorageError(
        'corrupt',
        'Retry recovery record conflicts with this attempt',
      )
    }
    writeRecoveryStore(store)
    return
  }
  if (countPartitionRecords(store, reservation.partitionDigest) >= MAX_PENDING_PER_SCOPE) {
    throw new IdempotencyCapacityError(reservation.scope)
  }
  const next = upsertRecoveryRecord(store, {
    k: reservation.key,
    p: reservation.payloadDigest,
    s: reservation.partitionDigest,
    t: createdAt,
  })
  writeRecoveryStore(next)
}

function clearStorageIfCurrent(reservation: Reservation): void {
  const store = readRecoveryStore()
  const current = findRecoveryRecord(
    store,
    reservation.partitionDigest,
    reservation.payloadDigest,
  )
  if (!current || current.k !== reservation.key) {
    return
  }
  writeRecoveryStore(
    removeMatchingRecoveryRecord(
      store,
      reservation.partitionDigest,
      reservation.payloadDigest,
      reservation.key,
    ),
  )
}

async function reserveForWrite(
  scope: string,
  fingerprint: string,
): Promise<Reservation> {
  const actorId = requireActor()
  const generation = getAuthGeneration()
  const memoryPartition = memoryPartitionFor(actorId, scope)
  const payloadDigest = await digestIdempotencyText(fingerprint)
  const partitionDigest = await digestIdempotencyText(`${actorId}\0${scope}`)
  assertCurrentAttempt(actorId, generation)
  const memoryExisting = memoryEntries(memoryPartition)?.get(fingerprint)
  const store = readRecoveryStore()
  const stored = findRecoveryRecord(store, partitionDigest, payloadDigest)

  if (stored && isRecoveryRecordExpired(stored)) {
    throw new IdempotencyStorageError(
      'stale',
      'Retry recovery is older than the 7-day server window',
    )
  }

  if (memoryExisting && stored && memoryExisting.key !== stored.k) {
    throw new IdempotencyStorageError(
      'corrupt',
      'Retry recovery record conflicts with this attempt',
    )
  }

  if (stored) {
    rememberPending(memoryPartition, fingerprint, stored.k)
    const reservation: Reservation = {
      actorId,
      generation,
      scope,
      memoryPartition,
      partitionDigest,
      fingerprint,
      payloadDigest,
      key: stored.k,
    }
    persistReservation(reservation, stored.t)
    return reservation
  }

  if (memoryExisting) {
    const reservation: Reservation = {
      actorId,
      generation,
      scope,
      memoryPartition,
      partitionDigest,
      fingerprint,
      payloadDigest,
      key: memoryExisting.key,
    }
    persistReservation(reservation, Date.now())
    return reservation
  }

  const storedCount = countPartitionRecords(store, partitionDigest)
  const memoryCount = memoryEntries(memoryPartition)?.size ?? 0
  if (Math.max(storedCount, memoryCount) >= MAX_PENDING_PER_SCOPE) {
    throw new IdempotencyCapacityError(scope)
  }

  const key = crypto.randomUUID()
  const reservation: Reservation = {
    actorId,
    generation,
    scope,
    memoryPartition,
    partitionDigest,
    fingerprint,
    payloadDigest,
    key,
  }
  persistReservation(reservation, Date.now())
  rememberPending(memoryPartition, fingerprint, key)
  return reservation
}

function clearIfCurrent(reservation: Reservation): void {
  clearMemoryIfCurrent(reservation)
  try {
    clearStorageIfCurrent(reservation)
  } catch {
    // Leave the recovery record if cleanup cannot be persisted. The same key
    // is reused on the next matching submit instead of minting a new write.
  }
}

/** Test helper — not for production call sites. */
export function peekIdempotencyScope(
  scope: string,
  payload: unknown,
): Pending | undefined {
  if (!currentActorId) {
    return undefined
  }
  return memoryEntries(memoryPartitionFor(currentActorId, scope))?.get(
    fingerprintIdempotencyPayload(payload),
  )
}

/** Test helper — not for production call sites. */
export function peekIdempotencyScopeSize(scope: string): number {
  if (!currentActorId) {
    return 0
  }
  return memoryEntries(memoryPartitionFor(currentActorId, scope))?.size ?? 0
}

/** Test helper — true only when a scope map exists, including empty leaks. */
export function hasIdempotencyScope(scope: string): boolean {
  if (!currentActorId) {
    return false
  }
  return pendingByPartition.has(memoryPartitionFor(currentActorId, scope))
}

/** Test helper — not for production call sites. */
export function peekIdempotencyRecoveryRecords(): RecoveryRecord[] {
  return readRecoveryStore().records
}

export function resetIdempotencyMemoryForTests(): void {
  pendingByPartition.clear()
}

export function resetIdempotencyForTests(): void {
  pendingByPartition.clear()
  currentActorId = null
  try {
    globalThis.sessionStorage?.removeItem(IDEMPOTENCY_STORAGE_KEY)
  } catch {
    // Tests still reset in-memory state if storage is unavailable.
  }
}

/**
 * A write is ambiguous unless the server confirmed it did not commit.
 * 4xx except 408/429/409 are treated as confirmed rejection. Conflict and
 * unknown/parse/network/5xx outcomes keep the pending key.
 */
export function isAmbiguousWriteFailure(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'IDEMPOTENCY_KEY_REUSED'
  ) {
    return true
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status
    if (
      status >= 500 ||
      status === 408 ||
      status === 409 ||
      status === 429
    ) {
      return true
    }
    if (status >= 400 && status < 500) {
      return false
    }
  }
  return true
}

export function idempotencyClientErrorKey(error: unknown): string | null {
  if (error instanceof IdempotencyCapacityError) {
    return 'common.idempotencyCapacity'
  }
  if (error instanceof IdempotencyStorageError) {
    return error.reason === 'stale'
      ? 'common.idempotencyStale'
      : 'common.idempotencyStorage'
  }
  return null
}

export async function withIdempotencyKey<T>(
  scope: string,
  payload: unknown,
  run: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  const fingerprint = fingerprintIdempotencyPayload(payload)
  const reservation = await reserveForWrite(scope, fingerprint)
  assertCurrentAttempt(reservation.actorId, reservation.generation)
  try {
    const result = await run(reservation.key)
    clearIfCurrent(reservation)
    return result
  } catch (error) {
    if (!isAmbiguousWriteFailure(error)) {
      clearIfCurrent(reservation)
    }
    throw error
  }
}
