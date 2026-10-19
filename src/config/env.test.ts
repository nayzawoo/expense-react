import { describe, expect, it } from 'vitest'

import { apiUrl } from '@/config/env'

describe('apiUrl', () => {
  it('builds same-origin API paths when the base URL is empty', () => {
    expect(apiUrl('/api/v1/auth/me')).toBe('/api/v1/auth/me')
    expect(apiUrl('api/v1/household')).toBe('/api/v1/household')
  })
})
