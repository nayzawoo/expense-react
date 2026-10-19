/**
 * Synthetic API payloads for Playwright route mocks.
 * No real credentials or personal information.
 */

export const sampleUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.com',
  displayName: 'Sample Member',
  role: 'MEMBER',
  mustChangePassword: false,
}

export const sampleHousehold = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sample Household',
  currency: 'MMK',
  currencyScale: 0,
  timezone: 'Asia/Yangon',
}

export const sampleDashboard = {
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
  ],
}

export const sampleAccounts = [
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
]

export const sampleCategories = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Food',
    color: '#AABBCC',
    iconKey: 'food',
    sortOrder: 1,
    status: 'ACTIVE',
    version: 0,
  },
]

export const sampleBeneficiaries = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  },
]

export const sampleExpenses = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    kind: 'EXPENSE',
    state: 'POSTED',
    effectiveDate: '2026-10-18',
    amount: '50',
    currency: 'MMK',
    note: 'Groceries',
    account: {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Cash',
      kind: 'CASH',
    },
    category: {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Food',
      kind: null,
    },
    beneficiary: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Family Pool',
      kind: 'HOUSEHOLD',
    },
    createdBy: {
      userId: '11111111-1111-4111-8111-111111111111',
      displayName: 'Sample Member',
    },
    recordedAt: '2026-10-18T04:00:00Z',
    version: 1,
    revisionNo: 1,
    capabilities: {
      canReplace: true,
      canVoid: true,
    },
  },
]
