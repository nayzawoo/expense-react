import { describe, expect, it } from 'vitest'

import { iconKeyAriaLabel } from '@/lib/category-icons'

describe('iconKeyAriaLabel', () => {
  it('humanizes backend keys in stable English without localization', () => {
    expect(iconKeyAriaLabel('food')).toBe('Food')
    expect(iconKeyAriaLabel('entertainment')).toBe('Entertainment')
    expect(iconKeyAriaLabel('other')).toBe('Other')
  })
})
