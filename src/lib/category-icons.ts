import { createElement, lazy, Suspense, type CSSProperties, type ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  KeyRound,
  MoreHorizontal,
  PawPrint,
  Phone,
  PiggyBank,
  Plane,
  Plug,
  Repeat,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Users,
  Utensils,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react'

import { CATEGORY_ICON_KEYS, type CategoryIconKey } from '@/api/categories'
import lucideNames from '@/lib/lucide-icon-names.json'

const lucideNameSet = new Set<string>(lucideNames)
const LazyDynamicIcon = lazy(() => import('lucide-react/dynamic').then((module) => ({ default: module.DynamicIcon })))
export const ALL_CATEGORY_ICON_KEYS: readonly string[] = [
  ...CATEGORY_ICON_KEYS,
  ...lucideNames.map((name) => `lucide:${name}`),
]
export function isCategoryIconKey(key: string): boolean {
  return Object.hasOwn(CATEGORY_ICON_MAP, key) || (key.startsWith('lucide:') && lucideNameSet.has(key.slice(7)))
}

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
  groceries: ShoppingCart,
  dining: UtensilsCrossed,
  coffee: Coffee,
  car: Car,
  fuel: Fuel,
  travel: Plane,
  utilities: Plug,
  phone: Phone,
  internet: Wifi,
  rent: KeyRound,
  clothing: Shirt,
  beauty: Sparkles,
  fitness: Dumbbell,
  pets: PawPrint,
  gifts: Gift,
  family: Users,
  work: Briefcase,
  insurance: Shield,
  savings: PiggyBank,
  charity: HeartHandshake,
  subscriptions: Repeat,
}

export function categoryIcon(iconKey: string): LucideIcon {
  if (Object.hasOwn(CATEGORY_ICON_MAP, iconKey)) {
    return CATEGORY_ICON_MAP[iconKey as CategoryIconKey]
  }
  return MoreHorizontal
}

/** Stable English accessible name from the backend icon key. Never localize. */
export function iconKeyAriaLabel(iconKey: string): string {
  if (!iconKey) {
    return iconKey
  }
  const name = iconKey.startsWith('lucide:') ? iconKey.slice(7).replaceAll('-', ' ') : iconKey
  return name.charAt(0).toUpperCase() + name.slice(1)
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
  if (iconKey.startsWith('lucide:') && lucideNameSet.has(iconKey.slice(7))) {
    const fallback = createElement(MoreHorizontal, { className, style, 'aria-hidden': true })
    return createElement(Suspense, { fallback }, createElement(LazyDynamicIcon, {
      key: iconKey,
      name: iconKey.slice(7) as import('lucide-react/dynamic').IconName,
      className,
      style,
      'aria-hidden': true,
      fallback: () => fallback,
    }))
  }
  return createElement(categoryIcon(iconKey), {
    className,
    style,
    'aria-hidden': true,
  })
}
