import { useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { ALL_CATEGORY_ICON_KEYS, CategoryIconView, iconKeyAriaLabel } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 100
const ICON_GRID_COLUMNS = 5

type CategoryIconPickerProps = {
  id?: string
  value: string
  color?: string
  disabled?: boolean
  onChange: (iconKey: string) => void
}

export function CategoryIconPicker({ id, value, color, disabled, onChange }: CategoryIconPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const matches = useMemo(() => {
    const terms = search.trim().toLowerCase().replaceAll('-', ' ').split(/\s+/).filter(Boolean)
    const keys = ALL_CATEGORY_ICON_KEYS.filter((key) => {
      const label = iconKeyAriaLabel(key).toLowerCase()
      return terms.every((term) => label.includes(term))
    })
    // The selected icon stays reachable without mounting the whole catalog.
    return keys.includes(value) ? [value, ...keys.filter((key) => key !== value)] : keys
  }, [search, value])
  const visible = matches.slice(0, limit)

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) {
      setSearch('')
      setLimit(PAGE_SIZE)
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const active = event.target
    if (!(active instanceof HTMLElement) || !active.dataset.iconKey) return
    const index = visible.indexOf(active.dataset.iconKey)
    if (index < 0) return
    const movements: Record<string, number> = {
      ArrowRight: index + 1, ArrowLeft: index - 1,
      ArrowDown: index + ICON_GRID_COLUMNS, ArrowUp: index - ICON_GRID_COLUMNS,
      Home: 0, End: visible.length - 1,
    }
    if (!Object.hasOwn(movements, event.key)) return
    event.preventDefault()
    const next = Math.max(0, Math.min(visible.length - 1, movements[event.key]))
    const button = event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-icon-key]')[next]
    button?.focus()
    button?.scrollIntoView?.({ block: 'nearest' })
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger id={id} disabled={disabled} render={
        <Button type="button" variant="outline" size="icon" disabled={disabled}
          data-icon-key={value} className="size-11"
          aria-label={`${t('categories.form.chooseIcon')} (${iconKeyAriaLabel(value)})`}
          style={{ color }} />
      }>
        <CategoryIconView iconKey={value} className="size-5" />
      </DialogTrigger>
      <DialogContent data-category-icon-picker=""
        className="grid max-h-[min(40rem,calc(100dvh-2rem))] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-sm"
        initialFocus={() => document.querySelector<HTMLInputElement>('[data-category-icon-search]') ?? true}>
        <DialogHeader><DialogTitle>{t('categories.form.iconPickerTitle')}</DialogTitle></DialogHeader>
        <Input data-category-icon-search="" type="search" value={search}
          aria-label={t('categories.form.searchIcons')} placeholder={t('categories.form.searchIcons')}
          className="h-11 text-base" onChange={(event) => { setSearch(event.target.value); setLimit(PAGE_SIZE) }} />
        <div className="min-h-0 overflow-y-auto overscroll-contain p-1">
          <div role="group" aria-label={t('categories.form.iconPickerTitle')}
            className="grid grid-cols-5 gap-2" onKeyDown={handleGridKeyDown}>
            {visible.map((key) => (
              <Button key={key} type="button" variant="outline" size="icon"
                aria-label={iconKeyAriaLabel(key)} title={iconKeyAriaLabel(key)} aria-pressed={key === value}
                data-icon-key={key} data-selected={key === value ? 'true' : undefined}
                className={cn('size-11', key === value && 'border-ring ring-3 ring-ring/50')}
                onClick={() => { onChange(key); setOpen(false) }}>
                <CategoryIconView iconKey={key} className="size-5" />
              </Button>
            ))}
          </div>
          {matches.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground" role="status">{t('categories.form.noIcons')}</p>}
          {visible.length < matches.length && <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setLimit((count) => count + PAGE_SIZE)}>{t('categories.form.moreIcons')}</Button>}
        </div>
        <DialogFooter className="items-center">
          <p className="mr-auto text-xs text-muted-foreground" role="status">{t('categories.form.iconCount', { shown: visible.length, total: matches.length })}</p>
          <DialogClose render={<Button type="button" variant="outline" />}>{t('common.cancel')}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
