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

export type NamedRef = {
  id: string
  name: string
}

export type PeriodCoverage = {
  from: string
  to: string
  complete: boolean
  reason: string | null
}

export type ReportPeriod = {
  from: string
  to: string
  coverage: PeriodCoverage
}

export type BalanceCoverage = {
  from: string
  complete: boolean
  omittedAccountIds: string[]
}

export type DashboardOverview = {
  expense: string
  income: string
  net: string
  previousSamePeriodExpense: string | null
  expenseDifference: string | null
  expenseDifferencePercent: string | null
  direction: string | null
  previousFiveMonthAverage: string | null
  elapsedDayAverage: string | null
}

export type DashboardAccountBalance = {
  id: string
  name: string
  balance: string
  negativeBalanceWarning: boolean
}

export type DashboardActivityKind = 'EXPENSE' | 'INCOME' | 'TRANSFER' | string

export type DashboardActivity = {
  id: string
  kind: DashboardActivityKind
  effectiveDate: string
  amount: string
  currency: string
  note: string | null
  recordedAt: string
  account: NamedRef | null
  sourceAccount: NamedRef | null
  destinationAccount: NamedRef | null
}

export type DashboardSnapshot = {
  currency: string
  timeZone: string
  asOf: string
  period: ReportPeriod
  comparisonPeriod: ReportPeriod
  balanceCoverage: BalanceCoverage
  totalBalance: string
  accounts: DashboardAccountBalance[]
  overview: DashboardOverview
  recentActivity: DashboardActivity[]
}
