import type { Account, CurrentUser, Household } from '@/api/types'

export const sampleUser: CurrentUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.com',
  displayName: 'Sample Member',
  role: 'MEMBER',
  mustChangePassword: false,
}

export const sampleAdminMustChange: CurrentUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  displayName: 'Sample Admin',
  role: 'ADMIN',
  mustChangePassword: true,
}

export const sampleHousehold: Household = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sample Household',
  currency: 'MMK',
  currencyScale: 0,
  timezone: 'Asia/Yangon',
}

export const sampleAccounts: Account[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Cash',
    type: 'CASH',
    ownerLabel: 'Shared',
    openedOn: '2026-01-01',
    openingAmount: '1000',
    currentBalance: '1250',
    balanceAsOf: '2026-10-19',
    balanceVersion: 2,
    negativeBalanceWarning: false,
    status: 'ACTIVE',
    sortOrder: 1,
    version: 0,
    currency: 'MMK',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Wallet',
    type: 'WALLET',
    ownerLabel: 'Shared',
    openedOn: '2026-02-01',
    openingAmount: '0',
    currentBalance: '-50',
    balanceAsOf: '2026-10-19',
    balanceVersion: 3,
    negativeBalanceWarning: true,
    status: 'ACTIVE',
    sortOrder: 2,
    version: 0,
    currency: 'MMK',
  },
]
