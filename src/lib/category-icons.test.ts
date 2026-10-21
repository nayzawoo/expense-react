import { describe, expect, it } from 'vitest'
import {
  Banknote,
  Bus,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
} from 'lucide-react'

import { CATEGORY_ICON_KEYS } from '@/api/categories'
import {
  CATEGORY_ICON_MAP,
  categoryIcon,
  iconKeyAriaLabel,
} from '@/lib/category-icons'

describe('category icons', () => {
  it('keeps the original nine mappings and expands to thirty distinct icons', () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(30)
    expect(CATEGORY_ICON_KEYS.slice(0, 9)).toEqual([
      'food',
      'transport',
      'home',
      'health',
      'shopping',
      'bills',
      'education',
      'entertainment',
      'other',
    ])
    expect(CATEGORY_ICON_KEYS.at(-1)).toBe('subscriptions')
    expect(CATEGORY_ICON_MAP.food).toBe(Utensils)
    expect(CATEGORY_ICON_MAP.transport).toBe(Bus)
    expect(CATEGORY_ICON_MAP.home).toBe(Home)
    expect(CATEGORY_ICON_MAP.health).toBe(HeartPulse)
    expect(CATEGORY_ICON_MAP.shopping).toBe(ShoppingBag)
    expect(CATEGORY_ICON_MAP.bills).toBe(Banknote)
    expect(CATEGORY_ICON_MAP.education).toBe(GraduationCap)
    expect(CATEGORY_ICON_MAP.entertainment).toBe(Clapperboard)
    expect(CATEGORY_ICON_MAP.other).toBe(MoreHorizontal)
    expect(new Set(Object.values(CATEGORY_ICON_MAP)).size).toBe(30)
    expect(categoryIcon('unknown')).toBe(MoreHorizontal)
  })
})

describe('iconKeyAriaLabel', () => {
  it('humanizes backend keys in stable English without localization', () => {
    expect(iconKeyAriaLabel('food')).toBe('Food')
    expect(iconKeyAriaLabel('entertainment')).toBe('Entertainment')
    expect(iconKeyAriaLabel('other')).toBe('Other')
    expect(iconKeyAriaLabel('subscriptions')).toBe('Subscriptions')
    for (const key of CATEGORY_ICON_KEYS) {
      expect(iconKeyAriaLabel(key)).toBe(
        key.charAt(0).toUpperCase() + key.slice(1),
      )
    }
  })
})
