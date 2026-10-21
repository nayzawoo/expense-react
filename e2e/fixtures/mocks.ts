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

export const sampleAdmin = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  displayName: 'Sample Admin',
  role: 'ADMIN',
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
  spendingPace: [
    {
      day: 1,
      currentCumulative: '0',
      previousCumulative: '40',
      expense: '0',
    },
    {
      day: 2,
      currentCumulative: '50',
      previousCumulative: '90',
      expense: '50',
    },
    {
      day: 3,
      currentCumulative: '200',
      previousCumulative: '140',
      expense: '150',
    },
    {
      day: 19,
      currentCumulative: '350',
      previousCumulative: '200',
      expense: '50',
    },
  ],
  categoryBreakdown: [
    {
      category: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Food',
      },
      amount: '200',
      sharePercent: '57.1',
    },
    {
      category: {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Transport',
      },
      amount: '150',
      sharePercent: '42.9',
    },
  ],
  categoryChanges: {
    increased: [],
    decreased: [],
  },
  beneficiarySpending: [
    {
      beneficiary: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Family Pool',
      },
      amount: '350',
    },
  ],
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

export const sampleAnalytics = {
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
      complete: true,
      reason: null,
    },
  },
  balanceCoverage: {
    from: '2026-01-01',
    complete: true,
    omittedAccountIds: [],
  },
  overview: {
    expense: '800',
    income: '1200',
    net: '400',
    previousSamePeriodExpense: '500',
    expenseDifference: '300',
    expenseDifferencePercent: '60.0',
    direction: 'UP',
    previousFiveMonthAverage: '450',
    elapsedDayAverage: '42',
  },
  monthlyTrend: [
    {
      month: '2026-05',
      expense: null,
      isPartial: false,
      coverage: 'UNCOVERED',
    },
    {
      month: '2026-06',
      expense: '420',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-07',
      expense: '390',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-08',
      expense: '510',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-09',
      expense: '530',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-10',
      expense: '800',
      isPartial: true,
      coverage: 'COMPLETE',
    },
  ],
  categoryBreakdown: [
    {
      category: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Food',
      },
      amount: '500',
      sharePercent: '62.5',
    },
    {
      category: {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Transport',
      },
      amount: '300',
      sharePercent: '37.5',
    },
  ],
  categoryChanges: {
    increased: [
      {
        category: {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Food',
        },
        currentAmount: '500',
        previousAmount: '200',
        difference: '300',
        differencePercent: '150.0',
        isNew: false,
      },
    ],
    decreased: [
      {
        category: {
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Bills',
        },
        currentAmount: '100',
        previousAmount: '250',
        difference: '-150',
        differencePercent: '-60.0',
        isNew: false,
      },
    ],
  },
  insight: {
    kind: 'UP',
    metric: {
      expenseDifferenceAbs: '300',
      expenseDifferencePercent: '60.0',
    },
    contributors: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Food',
      },
    ],
  },
}

export const sampleAnalyticsAsOfSeptember = {
  ...sampleAnalytics,
  asOf: '2026-09-30',
  period: {
    from: '2026-09-01',
    to: '2026-09-30',
    coverage: {
      from: '2026-09-01',
      to: '2026-09-30',
      complete: true,
      reason: null,
    },
  },
  comparisonPeriod: {
    from: '2026-08-01',
    to: '2026-08-30',
    coverage: {
      from: '2026-08-01',
      to: '2026-08-30',
      complete: true,
      reason: null,
    },
  },
  overview: {
    ...sampleAnalytics.overview,
    expense: '100',
    income: '200',
    net: '100',
    elapsedDayAverage: '3',
  },
  monthlyTrend: [
    {
      month: '2026-04',
      expense: null,
      isPartial: false,
      coverage: 'UNCOVERED',
    },
    {
      month: '2026-05',
      expense: '80',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-06',
      expense: '90',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-07',
      expense: '85',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-08',
      expense: '95',
      isPartial: false,
      coverage: 'COMPLETE',
    },
    {
      month: '2026-09',
      expense: '100',
      isPartial: true,
      coverage: 'COMPLETE',
    },
  ],
  categoryBreakdown: [
    {
      category: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Food',
      },
      amount: '100',
      sharePercent: '100.0',
    },
  ],
  categoryChanges: {
    increased: [],
    decreased: [
      {
        category: {
          id: '77777777-7777-4777-8777-777777777777',
          name: 'Transport',
        },
        currentAmount: '0',
        previousAmount: '40',
        difference: '-40',
        differencePercent: '-100.0',
        isNew: false,
      },
    ],
  },
  insight: {
    kind: 'DOWN',
    metric: {
      expenseDifferenceAbs: '40',
      expenseDifferencePercent: '-28.6',
    },
    contributors: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Transport',
      },
    ],
  },
}

export function analyticsWithManyCategories(count = 20) {
  const categoryBreakdown = Array.from({ length: count }, (_, index) => ({
    category: {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `Household supplies and long category name ${String(index + 1).padStart(2, '0')}`,
    },
    amount: String((count - index) * 10),
    sharePercent: '5.0',
  }))
  return {
    ...sampleAnalytics,
    categoryBreakdown,
  }
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
