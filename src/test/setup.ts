import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

import i18n from '@/i18n'
import { clearCsrf } from '@/api/client'

afterEach(() => {
  cleanup()
  clearCsrf()
  void i18n.changeLanguage('en')
})

await i18n.changeLanguage('en')
