export const themeStorageKey = 'expense_theme'

export const themeOptions = ['light', 'dark', 'system'] as const

export type ThemeOption = (typeof themeOptions)[number]

export type ResolvedTheme = 'light' | 'dark'

export function isThemeOption(value: string | null | undefined): value is ThemeOption {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredTheme(): ThemeOption {
  try {
    const stored = localStorage.getItem(themeStorageKey)
    return isThemeOption(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeStoredTheme(theme: ThemeOption): void {
  try {
    localStorage.setItem(themeStorageKey, theme)
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function resolveTheme(theme: ThemeOption): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

export function applyThemeClass(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
