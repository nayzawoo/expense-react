import { createElement, type CSSProperties, type ReactElement } from 'react'
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
  if (iconKey in CATEGORY_ICON_MAP) {
    return CATEGORY_ICON_MAP[iconKey as CategoryIconKey]
  }
  return MoreHorizontal
}

/** Stable English accessible name from the backend icon key. Never localize. */
export function iconKeyAriaLabel(iconKey: string): string {
  if (!iconKey) {
    return iconKey
  }
  return iconKey.charAt(0).toUpperCase() + iconKey.slice(1)
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
