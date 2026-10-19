export const IDEMPOTENCY_STORAGE_KEY = 'expense.idempotency.v1'
export const IDEMPOTENCY_SCHEMA_VERSION = 1
export const IDEMPOTENCY_RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type IdempotencyStorageReason =
  | 'unavailable'
  | 'blocked'
  | 'quota'
  | 'corrupt'
  | 'stale'
  | 'superseded'
  | 'missing-actor'

export class IdempotencyStorageError extends Error {
  readonly reason: IdempotencyStorageReason

  constructor(reason: IdempotencyStorageReason, message: string) {
    super(message)
    this.name = 'IdempotencyStorageError'
    this.reason = reason
  }
}

export type RecoveryRecord = {
  k: string
  p: string
  s: string
  t: number
}

export type RecoveryStore = {
  v: number
  records: RecoveryRecord[]
}

const DIGEST_PATTERN = /^[a-f0-9]{64}$/

function storageUnavailable(): IdempotencyStorageError {
  return new IdempotencyStorageError(
    'unavailable',
    'Retry recovery storage is not available',
  )
}

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )
  }
  return error instanceof Error && error.name === 'QuotaExceededError'
}

function isBlockedError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'SecurityError'
  }
  return error instanceof Error && error.name === 'SecurityError'
}

function getSessionStorage(): Storage {
  try {
    const storage = globalThis.sessionStorage
    if (!storage) {
      throw storageUnavailable()
    }
    return storage
  } catch (error) {
    if (error instanceof IdempotencyStorageError) {
      throw error
    }
    if (isBlockedError(error)) {
      throw new IdempotencyStorageError('blocked', 'Retry recovery storage is blocked')
    }
    throw storageUnavailable()
  }
}

function isRecord(value: unknown): value is RecoveryRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Partial<RecoveryRecord>
  return (
    typeof record.k === 'string' &&
    record.k.length > 0 &&
    typeof record.p === 'string' &&
    DIGEST_PATTERN.test(record.p) &&
    typeof record.s === 'string' &&
    DIGEST_PATTERN.test(record.s) &&
    typeof record.t === 'number' &&
    Number.isFinite(record.t)
  )
}

function parseStore(raw: string): RecoveryStore {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new IdempotencyStorageError(
      'corrupt',
      'Retry recovery storage is unreadable',
    )
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new IdempotencyStorageError('corrupt', 'Retry recovery storage is unreadable')
  }
  const store = parsed as Partial<RecoveryStore>
  if (store.v !== IDEMPOTENCY_SCHEMA_VERSION || !Array.isArray(store.records)) {
    throw new IdempotencyStorageError('corrupt', 'Retry recovery storage is unreadable')
  }
  if (!store.records.every(isRecord)) {
    throw new IdempotencyStorageError('corrupt', 'Retry recovery storage is unreadable')
  }
  const seen = new Set<string>()
  for (const record of store.records) {
    const identity = `${record.s}:${record.p}`
    if (seen.has(identity)) {
      throw new IdempotencyStorageError(
        'corrupt',
        'Retry recovery storage has conflicting records',
      )
    }
    seen.add(identity)
  }
  return { v: IDEMPOTENCY_SCHEMA_VERSION, records: store.records }
}

export function readRecoveryStore(): RecoveryStore {
  const storage = getSessionStorage()
  let raw: string | null
  try {
    raw = storage.getItem(IDEMPOTENCY_STORAGE_KEY)
  } catch (error) {
    if (isBlockedError(error)) {
      throw new IdempotencyStorageError('blocked', 'Retry recovery storage is blocked')
    }
    throw storageUnavailable()
  }
  if (raw === null) {
    return { v: IDEMPOTENCY_SCHEMA_VERSION, records: [] }
  }
  if (raw === '') {
    throw new IdempotencyStorageError(
      'corrupt',
      'Retry recovery storage is unreadable',
    )
  }
  return parseStore(raw)
}

export function writeRecoveryStore(store: RecoveryStore): void {
  const serialized = JSON.stringify({
    v: IDEMPOTENCY_SCHEMA_VERSION,
    records: store.records,
  })
  const storage = getSessionStorage()
  try {
    storage.setItem(IDEMPOTENCY_STORAGE_KEY, serialized)
    if (storage.getItem(IDEMPOTENCY_STORAGE_KEY) !== serialized) {
      throw storageUnavailable()
    }
  } catch (error) {
    if (error instanceof IdempotencyStorageError) {
      throw error
    }
    if (isQuotaError(error)) {
      throw new IdempotencyStorageError('quota', 'Retry recovery storage is full')
    }
    if (isBlockedError(error)) {
      throw new IdempotencyStorageError('blocked', 'Retry recovery storage is blocked')
    }
    throw storageUnavailable()
  }
}

export function findRecoveryRecord(
  store: RecoveryStore,
  partitionDigest: string,
  payloadDigest: string,
): RecoveryRecord | undefined {
  const matches = store.records.filter(
    (record) => record.s === partitionDigest && record.p === payloadDigest,
  )
  if (matches.length > 1) {
    throw new IdempotencyStorageError(
      'corrupt',
      'Retry recovery storage has conflicting records',
    )
  }
  return matches[0]
}

export function upsertRecoveryRecord(
  store: RecoveryStore,
  record: RecoveryRecord,
): RecoveryStore {
  const index = store.records.findIndex(
    (entry) => entry.s === record.s && entry.p === record.p,
  )
  const records = store.records.slice()
  if (index === -1) {
    records.push(record)
  } else {
    records[index] = record
  }
  return { v: IDEMPOTENCY_SCHEMA_VERSION, records }
}

export function removeMatchingRecoveryRecord(
  store: RecoveryStore,
  partitionDigest: string,
  payloadDigest: string,
  key: string,
): RecoveryStore {
  return {
    v: IDEMPOTENCY_SCHEMA_VERSION,
    records: store.records.filter(
      (record) =>
        !(
          record.s === partitionDigest &&
          record.p === payloadDigest &&
          record.k === key
        ),
    ),
  }
}

export function countPartitionRecords(
  store: RecoveryStore,
  partitionDigest: string,
): number {
  return store.records.filter((record) => record.s === partitionDigest).length
}

export function isRecoveryRecordExpired(
  record: RecoveryRecord,
  now: number = Date.now(),
): boolean {
  return now - record.t > IDEMPOTENCY_RECOVERY_TTL_MS
}
