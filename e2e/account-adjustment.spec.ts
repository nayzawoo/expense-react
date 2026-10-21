import { expect, test, type Page, type Route } from '@playwright/test'

import { mockAuthenticatedSession } from './fixtures/auth'
import {
  sampleAccounts,
  sampleAdmin,
  sampleDashboard,
  sampleHousehold,
} from './fixtures/mocks'

const archivedAccount = {
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Old cash',
  type: 'CASH',
  ownerLabel: 'Shared',
  openedOn: '2025-01-01',
  openingAmount: '20',
  currentBalance: '20',
  balanceAsOf: '2026-01-01',
  balanceVersion: 1,
  negativeBalanceWarning: false,
  status: 'ARCHIVED',
  sortOrder: 2,
  version: 0,
  currency: 'MMK',
}

const adminAccounts = [
  { ...sampleAccounts[0]!, currentBalance: '1250', balanceVersion: 2 },
  archivedAccount,
]

const postedAdjustment = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  kind: 'ADJUSTMENT',
  state: 'POSTED',
  effectiveDate: '2026-10-21',
  amount: '-50',
  currency: 'MMK',
  reason: 'Counted cash drawer',
  balanceBefore: '1250',
  observedBalance: '1200',
  observedBalanceVersion: 2,
  account: {
    id: sampleAccounts[0]!.id,
    name: sampleAccounts[0]!.name,
  },
  createdBy: {
    userId: sampleAdmin.id,
    displayName: sampleAdmin.displayName,
  },
  recordedAt: '2026-10-21T10:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canVoid: true },
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockAdminAdjustmentSession(page: Page): Promise<{
  reconcileKeys: string[]
  voidKeys: string[]
}> {
  const reconcileKeys: string[] = []
  const voidKeys: string[] = []
  let accounts = structuredClone(adminAccounts)
  let adjustments: typeof postedAdjustment[] = []
  const householdId = sampleHousehold.id
  const cashId = sampleAccounts[0]!.id

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const { pathname } = new URL(request.url())

    if (pathname === '/api/v1/auth/csrf') {
      await json(route, { token: 'e2e-csrf', headerName: 'X-CSRF-TOKEN' })
      return
    }
    if (pathname === '/api/v1/auth/activity' && method === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }
    if (pathname === '/api/v1/auth/me') {
      await json(route, sampleAdmin)
      return
    }
    if (pathname === '/api/v1/household') {
      await json(route, sampleHousehold)
      return
    }
    if (pathname === `/api/v1/households/${householdId}/reports/dashboard`) {
      await json(route, sampleDashboard)
      return
    }
    if (pathname === `/api/v1/households/${householdId}/accounts` && method === 'GET') {
      await json(route, accounts)
      return
    }
    if (
      pathname === `/api/v1/households/${householdId}/accounts/${cashId}` &&
      method === 'GET'
    ) {
      const cash = accounts.find((row) => row.id === cashId)
      await json(route, cash ?? accounts[0])
      return
    }
    if (
      pathname ===
        `/api/v1/households/${householdId}/accounts/${cashId}/reconciliations` &&
      method === 'POST'
    ) {
      const csrf = request.headers()['x-csrf-token']
      const key = request.headers()['idempotency-key']
      const payload = request.postDataJSON() as {
        actualBalance?: string
        expectedBalanceVersion?: number
        reason?: string
        effectiveDate?: string
      }
      expect(csrf).toBe('e2e-csrf')
      expect(key).toBeTruthy()
      expect(payload).toEqual({
        actualBalance: '1200',
        expectedBalanceVersion: accounts.find((row) => row.id === cashId)
          ?.balanceVersion,
        reason: 'Counted cash drawer',
      })
      expect(payload.effectiveDate).toBeUndefined()
      if (key) {
        reconcileKeys.push(key)
      }
      accounts = accounts.map((row) =>
        row.id === cashId
          ? {
              ...row,
              currentBalance: payload.actualBalance ?? row.currentBalance,
              balanceVersion: row.balanceVersion + 1,
            }
          : row,
      )
      adjustments = [{ ...postedAdjustment }]
      await json(route, postedAdjustment, 201)
      return
    }
    if (
      pathname === `/api/v1/households/${householdId}/adjustments` &&
      method === 'GET'
    ) {
      await json(route, adjustments)
      return
    }
    if (
      pathname ===
        `/api/v1/households/${householdId}/adjustments/${postedAdjustment.id}` &&
      method === 'GET'
    ) {
      await json(route, adjustments[0] ?? { ...postedAdjustment, state: 'VOID' })
      return
    }
    if (
      pathname ===
        `/api/v1/households/${householdId}/adjustments/${postedAdjustment.id}/void` &&
      method === 'POST'
    ) {
      const csrf = request.headers()['x-csrf-token']
      const key = request.headers()['idempotency-key']
      const match = request.headers()['if-match']
      const payload = request.postDataJSON() as { reason?: string }
      expect(csrf).toBe('e2e-csrf')
      expect(key).toBeTruthy()
      expect(match).toBe('"0"')
      expect(payload).toEqual({ reason: 'Entered twice' })
      if (key) {
        voidKeys.push(key)
      }
      accounts = accounts.map((row) =>
        row.id === cashId
          ? {
              ...row,
              currentBalance: '1250',
              balanceVersion: row.balanceVersion + 1,
            }
          : row,
      )
      adjustments = []
      await json(route, {
        ...postedAdjustment,
        state: 'VOID',
        capabilities: { canVoid: false },
        version: 1,
      })
      return
    }

    await json(route, { detail: `Unhandled mock path: ${pathname}` }, 404)
  })

  return { reconcileKeys, voidKeys }
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflowing = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    )
  })
  expect(overflowing).toBe(false)
}

test.describe('account adjustment', () => {
  test('members do not see an adjust action and do not fetch history', async ({
    page,
  }) => {
    const adjustmentCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/adjustments')) {
        adjustmentCalls.push(request.url())
      }
    })
    await mockAuthenticatedSession(page)
    await page.goto('/accounts')

    await expect(
      page.getByRole('heading', { name: 'Accounts', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('1,250 MMK')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Adjust balance' }),
    ).toHaveCount(0)
    expect(adjustmentCalls).toEqual([])
  })

  test('admin posts and voids an account adjustment, including a narrow viewport', async ({
    page,
  }) => {
    await mockAdminAdjustmentSession(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/accounts')

    await expect(page.getByText('1,250 MMK')).toBeVisible()
    await expect(page.getByText('Old cash')).toBeVisible()
    const cashRow = page.getByRole('row').filter({ hasText: '1,250 MMK' })
    await expect(cashRow.getByRole('button', { name: 'Adjust balance' })).toBeVisible()
    const archivedRow = page.getByRole('row').filter({ hasText: 'Old cash' })
    await expect(
      archivedRow.getByRole('button', { name: 'Adjust balance' }),
    ).toHaveCount(0)

    await cashRow.getByRole('button', { name: 'Adjust balance' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('Current balance')).toBeVisible()
    await expect(sheet.getByText('1,250 MMK')).toBeVisible()
    await sheet.getByLabel(/Actual balance/).fill('1200')
    await expect(sheet.getByText('-50 MMK')).toBeVisible()
    await sheet.getByLabel('Reason').fill('Counted cash drawer')
    await assertNoHorizontalOverflow(page)

    await sheet.getByRole('button', { name: 'Post adjustment' }).click()
    await expect(
      sheet.getByRole('button', { name: /Counted cash drawer/ }),
    ).toBeVisible()
    await expect(sheet.getByText('1,200 MMK', { exact: true })).toBeVisible()

    await sheet.getByRole('button', { name: /Counted cash drawer/ }).click()
    await sheet.getByLabel('Void reason').fill('Entered twice')
    await sheet.getByRole('button', { name: 'Void adjustment' }).click()
    await expect(
      sheet.getByText('No posted adjustments for this account.'),
    ).toBeVisible()
    await expect(sheet.getByText('1,250 MMK', { exact: true })).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(sheet.getByText('Current balance')).toBeVisible()
    await assertNoHorizontalOverflow(page)
  })
})
