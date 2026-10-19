function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** Browser-facing API origin. Empty means same-origin (recommended with the Vite proxy). */
export const apiBaseUrl = trimTrailingSlash(
  (import.meta.env.VITE_API_BASE_URL ?? '').trim(),
)

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalized}`
}
