import { Banknote, Landmark, Wallet, type LucideIcon } from 'lucide-react'

import type { Account, AccountType } from '@/api/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { accountSelectLabel } from '@/lib/account-label'

const accountTypeIcons: Record<AccountType, LucideIcon> = {
  BANK: Landmark,
  WALLET: Wallet,
  CASH: Banknote,
}

type AccountSelectProps = {
  id: string
  accounts: Account[]
  value: string
  onValueChange: (accountId: string) => void
  disabled?: boolean
  emptyLabel: string
}

function AccountOption({ account }: { account: Account }) {
  const Icon = accountTypeIcons[account.type] ?? Wallet
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{accountSelectLabel(account)}</span>
    </span>
  )
}

export function AccountSelect({
  id,
  accounts,
  value,
  onValueChange,
  disabled = false,
  emptyLabel,
}: AccountSelectProps) {
  const items = accounts.map((account) => ({
    value: account.id,
    label: <AccountOption account={account} />,
  }))
  const selected = accounts.some((account) => account.id === value)
    ? value
    : null

  return (
    <Select
      items={items}
      value={selected}
      onValueChange={(next) => {
        if (typeof next === 'string') {
          onValueChange(next)
        }
      }}
      disabled={disabled || accounts.length === 0}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem
            key={account.id}
            value={account.id}
            label={accountSelectLabel(account)}
          >
            <AccountOption account={account} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
