export type UserRole = 'ADMIN' | 'MEMBER'

export type AccountType = 'BANK' | 'WALLET' | 'CASH'

export type AccountStatus = 'ACTIVE' | 'ARCHIVED'

export type CsrfBootstrap = {
  token: string
  headerName: string
}

export type CurrentUser = {
  id: string
  email: string
  displayName: string
  role: UserRole
  mustChangePassword: boolean
}

export type Household = {
  id: string
  name: string
  currency: string
  currencyScale: number
  timezone: string
}

export type Account = {
  id: string
  name: string
  type: AccountType
  ownerLabel: string
  openedOn: string
  openingAmount: string
  currentBalance: string
  balanceAsOf: string
  balanceVersion: number
  negativeBalanceWarning: boolean
  status: AccountStatus
  sortOrder: number
  version: number
  currency: string
}
