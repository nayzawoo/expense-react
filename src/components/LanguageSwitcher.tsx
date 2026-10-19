import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { SupportedLanguage } from '@/i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current: SupportedLanguage = (
    i18n.resolvedLanguage ?? i18n.language
  ).startsWith('my')
    ? 'my'
    : 'en'

  function setLanguage(next: SupportedLanguage) {
    void i18n.changeLanguage(next)
    document.documentElement.lang = next
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="size-4 text-muted-foreground" aria-hidden />
      <ToggleGroup
        value={[current]}
        onValueChange={(values) => {
          const next = values[0]
          if (next === 'en' || next === 'my') {
            setLanguage(next)
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={t('language.label')}
      >
        <ToggleGroupItem value="en" aria-label={t('language.en')}>
          {t('language.en')}
        </ToggleGroupItem>
        <ToggleGroupItem value="my" aria-label={t('language.my')}>
          {t('language.my')}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
