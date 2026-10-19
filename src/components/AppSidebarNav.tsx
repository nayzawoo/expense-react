import { NavLink } from 'react-router-dom'
import {
  ArrowRightLeft,
  BarChart3,
  LayoutDashboard,
  Receipt,
  Settings,
  Tags,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', end: true, icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/expenses', end: false, icon: Receipt, labelKey: 'nav.expenses' },
  {
    to: '/transfers',
    end: false,
    icon: ArrowRightLeft,
    labelKey: 'nav.transfers',
  },
  { to: '/accounts', end: false, icon: Wallet, labelKey: 'nav.accounts' },
  { to: '/categories', end: false, icon: Tags, labelKey: 'nav.categories' },
  {
    to: '/beneficiaries',
    end: false,
    icon: Users,
    labelKey: 'nav.beneficiaries',
  },
  { to: '/reports', end: false, icon: BarChart3, labelKey: 'nav.reports' },
  {
    to: '/members',
    end: false,
    icon: UsersRound,
    labelKey: 'nav.members',
  },
  { to: '/settings', end: false, icon: Settings, labelKey: 'nav.settings' },
] as const

type AppSidebarNavProps = {
  onNavigate?: () => void
  className?: string
}

export function AppSidebarNav({ onNavigate, className }: AppSidebarNavProps) {
  const { t } = useTranslation()

  return (
    <nav
      className={cn('flex flex-1 flex-col gap-1', className)}
      aria-label={t('nav.menu')}
    >
      {navItems.map(({ to, end, icon: Icon, labelKey }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              buttonVariants({
                variant: isActive ? 'secondary' : 'ghost',
              }),
              'w-full justify-start',
            )
          }
        >
          <Icon data-icon="inline-start" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
