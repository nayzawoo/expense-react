import { apiUrl } from '@/config/env'
import { ApiError } from '@/api/errors'
import type { CsrfBootstrap } from '@/api/types'

type CsrfState = CsrfBootstrap | null

let csrfState: CsrfState = null
let csrfInFlight: Promise<CsrfBootstrap> | null = null

export function clearCsrf(): void {
  csrfState = null
  csrfInFlight = null
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

export async function ensureCsrf(): Promise<CsrfBootstrap> {
  if (csrfState) {
    return csrfState
  }
  if (!csrfInFlight) {
    csrfInFlight = (async () => {
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
      csrfState = body
      return body
    })().finally(() => {
      csrfInFlight = null
    })
  }
  return csrfInFlight
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  csrf?: boolean
  headers?: HeadersInit
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, csrf = false, headers: initHeaders, ...rest } = options
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
    if (response.status === 403 && csrf) {
      clearCsrf()
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
