import { apiUrl } from '@/config/env'
import { ApiError } from '@/api/errors'
import type { CsrfBootstrap } from '@/api/types'

type CsrfState = CsrfBootstrap | null

let csrfState: CsrfState = null
let csrfInFlight: Promise<CsrfBootstrap> | null = null
let authGeneration = 0

type UnauthorizedHandler = (detail: { path: string }) => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Paths where HTTP 401 means bad credentials / challenge failure, not a dead session.
 * Do not clear the client auth snapshot for these.
 */
const CREDENTIAL_401_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/password',
])

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
): void {
  unauthorizedHandler = handler
}

export function getAuthGeneration(): number {
  return authGeneration
}

/** Advance the auth generation and drop CSRF that belonged to the prior session. */
export function advanceAuthGeneration(): number {
  authGeneration += 1
  csrfState = null
  csrfInFlight = null
  return authGeneration
}

export function clearCsrf(): void {
  csrfState = null
  csrfInFlight = null
}

/** Test helper — not for production call sites. */
export function resetAuthClientForTests(): void {
  authGeneration = 0
  csrfState = null
  csrfInFlight = null
  unauthorizedHandler = null
}

async function readError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed'
  let code: string | undefined

  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as {
        detail?: string
        title?: string
        message?: string
        code?: string
        error?: string
      }
      message = body.detail ?? body.title ?? body.message ?? body.error ?? message
      code = body.code
    } else {
      const text = (await response.text()).trim()
      if (text) {
        message = text
      }
    }
  } catch {
    // Keep status text when the body is not readable.
  }

  return new ApiError(response.status, message, code)
}

function normalizeApiPath(path: string): string {
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return new URL(path).pathname
    }
  } catch {
    // fall through
  }
  const q = path.indexOf('?')
  return q === -1 ? path : path.slice(0, q)
}

export async function ensureCsrf(): Promise<CsrfBootstrap> {
  if (csrfState) {
    return csrfState
  }
  if (!csrfInFlight) {
    const generation = authGeneration
    const pending = (async () => {
      const response = await fetch(apiUrl('/api/v1/auth/csrf'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        throw await readError(response)
      }
      const body = (await response.json()) as CsrfBootstrap
      if (generation !== authGeneration) {
        throw new TypeError('CSRF bootstrap was superseded')
      }
      csrfState = body
      return body
    })()
    csrfInFlight = pending
    void pending
      .finally(() => {
        if (csrfInFlight === pending) {
          csrfInFlight = null
        }
      })
      .catch(() => {
        // Callers of csrfInFlight observe the rejection.
      })
  }
  return csrfInFlight
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  csrf?: boolean
  headers?: HeadersInit
  /** Skip session-invalidation side effects (rare; prefer default). */
  ignoreUnauthorized?: boolean
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    body,
    csrf = false,
    headers: initHeaders,
    ignoreUnauthorized = false,
    ...rest
  } = options
  const requestGeneration = authGeneration
  const headers = new Headers(initHeaders)
  headers.set('Accept', 'application/json')

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (csrf) {
    const token = await ensureCsrf()
    headers.set(token.headerName, token.token)
  }

  const response = await fetch(apiUrl(path), {
    ...rest,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const generationCurrent = requestGeneration === authGeneration
    if (response.status === 403 && csrf && generationCurrent) {
      clearCsrf()
    }
    if (response.status === 401 && !ignoreUnauthorized) {
      const normalized = normalizeApiPath(path)
      if (!CREDENTIAL_401_PATHS.has(normalized) && generationCurrent) {
        clearCsrf()
        unauthorizedHandler?.({ path: normalized })
      }
    }
    throw await readError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return undefined as T
  }

  return (await response.json()) as T
}
