import { createContext } from 'react'

import type { ResolvedTheme, ThemeOption } from '@/theme/theme'

export type ThemeContextValue = {
  theme: ThemeOption
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeOption) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
