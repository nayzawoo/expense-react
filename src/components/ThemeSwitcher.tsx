import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTheme } from '@/theme/useTheme'
import type { ThemeOption } from '@/theme/theme'
import { cn } from '@/lib/utils'

type ThemeSwitcherProps = {
  className?: string
  /** Show text labels next to icons (settings). Header stays icon-only. */
  showLabels?: boolean
}

const options: Array<{
  value: ThemeOption
  icon: typeof Sun
  labelKey: 'theme.light' | 'theme.dark' | 'theme.system'
}> = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
]

export function ThemeSwitcher({
  className,
  showLabels = false,
}: ThemeSwitcherProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabels ? (
        <Sun className="size-4 text-muted-foreground" aria-hidden />
      ) : null}
      <ToggleGroup
        value={[theme]}
        onValueChange={(values) => {
          const next = values[0]
          if (next === 'light' || next === 'dark' || next === 'system') {
            setTheme(next)
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={t('theme.label')}
      >
        {options.map(({ value, icon: Icon, labelKey }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={t(labelKey)}
            title={t(labelKey)}
          >
            <Icon />
            {showLabels ? <span>{t(labelKey)}</span> : null}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
