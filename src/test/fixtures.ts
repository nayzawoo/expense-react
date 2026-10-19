import type {
  Account,
  CurrentUser,
  DashboardSnapshot,
  Household,
} from '@/api/types'

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

export const sampleDashboard: DashboardSnapshot = {
  currency: 'MMK',
  timeZone: 'Asia/Yangon',
  asOf: '2026-10-19',
  period: {
    from: '2026-10-01',
    to: '2026-10-19',
    coverage: {
      from: '2026-10-01',
      to: '2026-10-19',
      complete: true,
      reason: null,
    },
  },
  comparisonPeriod: {
    from: '2026-09-01',
    to: '2026-09-19',
    coverage: {
      from: '2026-09-01',
      to: '2026-09-19',
      complete: false,
      reason: 'ACCOUNT_OPENING_GAP',
    },
  },
  balanceCoverage: {
    from: '2026-01-01',
    complete: true,
    omittedAccountIds: [],
  },
  totalBalance: '1200',
  accounts: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Cash',
      balance: '1250',
      negativeBalanceWarning: false,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Wallet',
      balance: '-50',
      negativeBalanceWarning: true,
    },
  ],
  overview: {
    expense: '350',
    income: '500',
    net: '150',
    previousSamePeriodExpense: null,
    expenseDifference: null,
    expenseDifferencePercent: null,
    direction: null,
    previousFiveMonthAverage: null,
    elapsedDayAverage: '18',
  },
  recentActivity: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'EXPENSE',
      effectiveDate: '2026-10-18',
      amount: '50',
      currency: 'MMK',
      note: 'Groceries',
      recordedAt: '2026-10-18T04:00:00Z',
      account: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Cash',
      },
      sourceAccount: null,
      destinationAccount: null,
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      kind: 'INCOME',
      effectiveDate: '2026-10-15',
      amount: '200',
      currency: 'MMK',
      note: null,
      recordedAt: '2026-10-15T02:00:00Z',
      account: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Cash',
      },
      sourceAccount: null,
      destinationAccount: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      kind: 'TRANSFER',
      effectiveDate: '2026-10-12',
      amount: '100',
      currency: 'MMK',
      note: null,
      recordedAt: '2026-10-12T03:00:00Z',
      account: null,
      sourceAccount: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Cash',
      },
      destinationAccount: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Wallet',
      },
    },
  ],
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
