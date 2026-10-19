import { createElement, type CSSProperties, type ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Bus,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  ShoppingBag,
  Clapperboard,
  Utensils,
} from 'lucide-react'

import type { CategoryIconKey } from '@/api/categories'

export const CATEGORY_ICON_MAP: Record<CategoryIconKey, LucideIcon> = {
  food: Utensils,
  transport: Bus,
  home: Home,
  health: HeartPulse,
  shopping: ShoppingBag,
  bills: Banknote,
  education: GraduationCap,
  entertainment: Clapperboard,
  other: MoreHorizontal,
}

export function categoryIcon(iconKey: string): LucideIcon {
  if (iconKey in CATEGORY_ICON_MAP) {
    return CATEGORY_ICON_MAP[iconKey as CategoryIconKey]
  }
  return MoreHorizontal
}

type CategoryIconViewProps = {
  iconKey: string
  className?: string
  style?: CSSProperties
}

export function CategoryIconView({
  iconKey,
  className,
  style,
}: CategoryIconViewProps): ReactElement {
  return createElement(categoryIcon(iconKey), {
    className,
    style,
    'aria-hidden': true,
  })
}
