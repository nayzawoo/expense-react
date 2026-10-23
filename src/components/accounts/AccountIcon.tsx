import { useState } from 'react'
import { Banknote, Landmark, Wallet } from 'lucide-react'

import type { AccountType } from '@/api/types'
import { resolveAccountBrand } from '@/lib/account-brand'
import { cn } from '@/lib/utils'

type AccountIconProps = {
  name: string
  type?: AccountType
  size?: 'sm' | 'md'
  className?: string
}

export function AccountIcon({ name, type, size = 'sm', className }: AccountIconProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const brand = resolveAccountBrand(name) ?? (type === 'CASH' ? 'cash' : null)
  const source = brand ? `${import.meta.env.BASE_URL}images/accounts/${brand}.png` : null
  const box = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10',
    size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-[10px]',
    className,
  )

  if (source && failedSource !== source) {
    return (
      <img
        src={source}
        alt=""
        aria-hidden="true"
        width={size === 'sm' ? 28 : 36}
        height={size === 'sm' ? 28 : 36}
        className={cn(box, 'object-cover')}
        onError={() => setFailedSource(source)}
      />
    )
  }

  const Icon = type === 'CASH' || brand === 'cash' ? Banknote : type === 'WALLET' ? Wallet : Landmark
  return (
    <span
      aria-hidden="true"
      className={cn(box, 'text-white', type === 'WALLET' ? 'bg-indigo-500' : 'bg-slate-500')}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-5'} />
    </span>
  )
}

export function AccountLabel({ name, type, size, className, ownerLabel }: AccountIconProps & { ownerLabel?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <AccountIcon name={name} type={type} size={size} />
      <span className="min-w-0 break-words">
        <span className="block font-medium">{name}</span>
        {ownerLabel ? <span className="block text-xs font-normal text-muted-foreground">{ownerLabel}</span> : null}
      </span>
    </span>
  )
}
