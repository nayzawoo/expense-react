import { expect, test, type Page, type Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleAdmin,
  sampleBeneficiaries,
  sampleCategories,
  sampleExpenses,
  sampleHousehold,
  sampleUser,
} from './fixtures/mocks'

/**
 * Isolated remaining-page form modal coverage. Local synthetic fixtures and
 * route overrides only; no live credentials or backend calls.
 */

const walletAccount = {
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
}

const accounts = [sampleAccounts[0]!, walletAccount]

const transfer = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  kind: 'TRANSFER',
  state: 'POSTED',
  effectiveDate: '2026-10-12',
  amount: '100',
  currency: 'MMK',
  note: 'Move to wallet',
  sourceAccount: {
    id: accounts[0]!.id,
    name: accounts[0]!.name,
  },
  destinationAccount: {
    id: walletAccount.id,
    name: walletAccount.name,
  },
  createdBy: {
    userId: sampleAdmin.id,
    displayName: sampleAdmin.displayName,
  },
  recordedAt: '2026-10-12T03:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canVoid: true },
}

const members = [
  {
    id: sampleAdmin.id,
    email: sampleAdmin.email,
    displayName: sampleAdmin.displayName,
    role: 'ADMIN',
    status: 'ACTIVE',
    mustChangePassword: false,
    passwordChangeCompleted: true,
  },
  {
    id: sampleUser.id,
    email: sampleUser.email,
    displayName: sampleUser.displayName,
    role: 'MEMBER',
    status: 'ACTIVE',
    mustChangePassword: true,
    passwordChangeCompleted: false,
  },
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
    id: accounts[0]!.id,
    name: accounts[0]!.name,
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

async function mockFormModalSession(
  page: Page,
  options: { hangExpenseCreate?: boolean } = {},
): Promise<void> {
  const householdId = sampleHousehold.id

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const { pathname } = new URL(request.url())

    if (pathname === '/api/v1/auth/activity' && method === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }

    if (pathname === '/api/v1/auth/csrf' && method === 'GET') {
      await json(route, { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' })
      return
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      await json(route, sampleAdmin)
      return
    }

    if (pathname === '/api/v1/household' && method === 'GET') {
      await json(route, sampleHousehold)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/accounts` &&
      method === 'GET'
    ) {
      await json(route, accounts)
      return
    }

    const accountMatch = pathname.match(
      new RegExp(`^/api/v1/households/${householdId}/accounts/([0-9a-f-]+)$`),
    )
    if (accountMatch && method === 'GET') {
      const account = accounts.find((row) => row.id === accountMatch[1])
      await json(route, account ?? { detail: 'Not found' }, account ? 200 : 404)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/adjustments` &&
      method === 'GET'
    ) {
      await json(route, [postedAdjustment])
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/expenses` &&
      method === 'GET'
    ) {
      await json(route, sampleExpenses)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/expenses` &&
      method === 'POST'
    ) {
      if (options.hangExpenseCreate) {
        await new Promise(() => {})
        return
      }
      await json(route, { detail: 'Mocked API is read-only here' }, 405)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/transfers` &&
      method === 'GET'
    ) {
      await json(route, [transfer])
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/categories` &&
      method === 'GET'
    ) {
      await json(route, sampleCategories)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/beneficiaries` &&
      method === 'GET'
    ) {
      await json(route, sampleBeneficiaries)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/users` &&
      method === 'GET'
    ) {
      await json(route, members)
      return
    }

    if (method !== 'GET') {
      await json(route, { detail: 'Mocked API is read-only here' }, 405)
      return
    }

    await json(route, { detail: `Unhandled mock path: ${pathname}` }, 404)
  })
}

async function assertDialogFitsViewport(page: Page): Promise<void> {
  const dialog = page.locator('[data-slot="dialog-content"]').first()
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
  const centerX = box!.x + box!.width / 2
  expect(centerX).toBeGreaterThan(viewport!.width * 0.3)
  expect(centerX).toBeLessThan(viewport!.width * 0.7)
}

async function assertOpenDialog(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
  await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
  await assertDialogFitsViewport(page)
  return dialog
}

const remainingForms: Array<{
  path: string
  heading: string
  title: string
  open: (page: Page) => Promise<void>
}> = [
  {
    path: '/accounts',
    heading: 'Accounts',
    title: 'Add account',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add account' }).click()
    },
  },
  {
    path: '/accounts',
    heading: 'Accounts',
    title: 'Adjust balance',
    open: async (page) => {
      await page
        .getByRole('row')
        .filter({ hasText: '1,250 MMK' })
        .getByRole('button', { name: 'Adjust balance' })
        .click()
    },
  },
  {
    path: '/expenses',
    heading: 'Expenses',
    title: 'Add expense',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add expense' }).click()
    },
  },
  {
    path: '/expenses',
    heading: 'Expenses',
    title: 'Edit expense',
    open: async (page) => {
      await page
        .getByRole('row')
        .filter({ hasText: 'Groceries' })
        .getByRole('button', { name: 'Edit' })
        .click()
    },
  },
  {
    path: '/transfers',
    heading: 'Transfers',
    title: 'Add transfer',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add transfer' }).click()
    },
  },
  {
    path: '/transfers',
    heading: 'Transfers',
    title: 'Transfer details',
    open: async (page) => {
      await page.getByRole('button', { name: 'View' }).click()
    },
  },
  {
    path: '/beneficiaries',
    heading: 'Beneficiaries',
    title: 'Add beneficiary',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add beneficiary' }).click()
    },
  },
  {
    path: '/beneficiaries',
    heading: 'Beneficiaries',
    title: 'Edit beneficiary',
    open: async (page) => {
      await page
        .getByRole('row')
        .filter({ hasText: 'Family Pool' })
        .getByRole('button', { name: 'Edit' })
        .click()
    },
  },
  {
    path: '/members',
    heading: 'Members',
    title: 'Add member',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add member' }).click()
    },
  },
  {
    path: '/members',
    heading: 'Members',
    title: 'Edit member',
    open: async (page) => {
      await page
        .getByRole('row')
        .filter({ hasText: 'Sample Member' })
        .getByRole('button', { name: 'Edit' })
        .click()
    },
  },
  {
    path: '/members',
    heading: 'Members',
    title: 'Reset temporary password',
    open: async (page) => {
      await page
        .getByRole('row')
        .filter({ hasText: 'Sample Member' })
        .getByRole('button', { name: 'Reset password' })
        .click()
    },
  },
]

test.describe('form modals', () => {
  test('remaining page forms open as centered dialogs and dismiss with Escape or Cancel', async ({
    page,
  }) => {
    await mockFormModalSession(page)

    for (const form of remainingForms) {
      await page.goto(form.path)
      await expect(
        page.getByRole('heading', { name: form.heading, level: 1 }),
      ).toBeVisible()
      await form.open(page)
      const dialog = await assertOpenDialog(page, form.title)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    }

    await page.goto('/beneficiaries')
    await page.getByRole('button', { name: 'Add beneficiary' }).click()
    const dialog = await assertOpenDialog(page, 'Add beneficiary')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('pending save blocks Escape, backdrop, close, and cancel', async ({
    page,
  }) => {
    await mockFormModalSession(page, { hangExpenseCreate: true })
    await page.goto('/expenses')
    await page.getByRole('button', { name: 'Add expense' }).click()

    const dialog = await assertOpenDialog(page, 'Add expense')
    await dialog.getByLabel(/Amount/).fill('25')
    await dialog.getByRole('button', { name: 'Save expense' }).click()
    await expect(
      dialog.getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()

    await page.locator('[data-slot="dialog-overlay"]').click({
      position: { x: 2, y: 2 },
      force: true,
    })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
  })

  test('short mobile viewport keeps the modal in bounds and submit reachable', async ({
    page,
  }) => {
    await mockFormModalSession(page)
    await page.setViewportSize({ width: 390, height: 667 })
    await page.goto('/accounts')
    await page
      .getByRole('row')
      .filter({ hasText: '1,250 MMK' })
      .getByRole('button', { name: 'Adjust balance' })
      .click()

    const dialog = await assertOpenDialog(page, 'Adjust balance')
    await expect(dialog.getByText('Current balance')).toBeVisible()
    const submit = dialog.getByRole('button', { name: 'Post adjustment' })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeVisible()
    await assertDialogFitsViewport(page)
  })
})
