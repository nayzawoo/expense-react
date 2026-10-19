import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ThemeContext } from '@/theme/theme-context'
import {
  applyThemeClass,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ThemeOption,
} from '@/theme/theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOption>(() => readStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(theme))

  const setTheme = useCallback((next: ThemeOption) => {
    setThemeState(next)
    writeStoredTheme(next)
  }, [])

  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)

    if (theme !== 'system' || typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const nextResolved = resolveTheme('system')
      setResolvedTheme(nextResolved)
      applyThemeClass(nextResolved)
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
