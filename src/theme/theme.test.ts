import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyThemeClass,
  isThemeOption,
  resolveTheme,
  themeStorageKey,
  writeStoredTheme,
  readStoredTheme,
} from '@/theme/theme'

describe('theme helpers', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    localStorage.removeItem(themeStorageKey)
    vi.restoreAllMocks()
  })

  it('validates theme options', () => {
    expect(isThemeOption('light')).toBe(true)
    expect(isThemeOption('dark')).toBe(true)
    expect(isThemeOption('system')).toBe(true)
    expect(isThemeOption('auto')).toBe(false)
  })

  it('resolves explicit themes without reading the system preference', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('persists and reads the stored preference', () => {
    writeStoredTheme('dark')
    expect(localStorage.getItem(themeStorageKey)).toBe('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('applies the dark class and color-scheme on the document element', () => {
    applyThemeClass('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyThemeClass('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
