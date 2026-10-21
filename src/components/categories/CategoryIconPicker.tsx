import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CATEGORY_ICON_KEYS,
  type CategoryIconKey,
} from '@/api/categories'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CategoryIconView, iconKeyAriaLabel } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

const ICON_GRID_COLUMNS = 3

type CategoryIconPickerProps = {
  id?: string
  value: string
  color?: string
  disabled?: boolean
  onChange: (iconKey: string) => void
}

export function CategoryIconPicker({
  id,
  value,
  color,
  disabled,
  onChange,
}: CategoryIconPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  function chooseIcon(key: string) {
    onChange(key)
    setOpen(false)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const active = event.target
    if (!(active instanceof HTMLElement) || !active.dataset.iconKey) {
      return
    }

    const currentIndex = CATEGORY_ICON_KEYS.indexOf(
      active.dataset.iconKey as CategoryIconKey,
    )
    if (currentIndex < 0) {
      return
    }

    let nextIndex = currentIndex
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = Math.min(CATEGORY_ICON_KEYS.length - 1, currentIndex + 1)
        break
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1)
        break
      case 'ArrowDown':
        nextIndex = Math.min(
          CATEGORY_ICON_KEYS.length - 1,
          currentIndex + ICON_GRID_COLUMNS,
        )
        break
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - ICON_GRID_COLUMNS)
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = CATEGORY_ICON_KEYS.length - 1
        break
      default:
        return
    }

    if (nextIndex === currentIndex) {
      return
    }

    event.preventDefault()
    const nextKey = CATEGORY_ICON_KEYS[nextIndex]
    const next = event.currentTarget.querySelector<HTMLElement>(
      `[data-icon-key="${nextKey}"]`,
    )
    next?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        id={id}
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            data-icon-key={value}
            aria-label={`${t('categories.form.chooseIcon')} (${iconKeyAriaLabel(value)})`}
            style={{ color }}
          />
        }
      >
        <CategoryIconView iconKey={value} className="size-4" />
      </DialogTrigger>
      <DialogContent
        data-category-icon-picker=""
        className="sm:max-w-xs"
        initialFocus={() => {
          const selected = document.querySelector<HTMLElement>(
            '[data-category-icon-picker] [data-selected="true"]',
          )
          return selected ?? true
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('categories.form.iconPickerTitle')}</DialogTitle>
        </DialogHeader>
        <div
          role="group"
          aria-label={t('categories.form.iconPickerTitle')}
          className="grid grid-cols-3 gap-2"
          onKeyDown={handleGridKeyDown}
        >
          {CATEGORY_ICON_KEYS.map((key) => {
            const selected = key === value
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="icon"
                aria-label={iconKeyAriaLabel(key)}
                aria-pressed={selected}
                data-icon-key={key}
                data-selected={selected ? 'true' : undefined}
                className={cn(selected && 'border-ring ring-3 ring-ring/50')}
                onClick={() => chooseIcon(key)}
              >
                <CategoryIconView iconKey={key} className="size-4" />
              </Button>
            )
          })}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t('common.cancel')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
