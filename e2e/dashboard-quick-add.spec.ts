import { expect, test, type Page, type Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleBeneficiaries,
  sampleCategories,
  sampleDashboard,
  sampleHousehold,
  sampleUser,
} from './fixtures/mocks'

/**
 * Isolated dashboard quick-add coverage. Local synthetic fixtures and
 * route overrides only; no live credentials or backend calls.
 */

const archivedAccount = {
  ...sampleAccounts[0]!,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Old cash',
  status: 'ARCHIVED',
}

const createdExpense = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  kind: 'EXPENSE',
  state: 'POSTED',
  effectiveDate: '2026-10-19',
  amount: '10',
  currency: 'MMK',
  note: 'Market',
  account: {
    id: sampleAccounts[0]!.id,
    name: sampleAccounts[0]!.name,
    kind: 'CASH',
  },
  category: {
    id: sampleCategories[0]!.id,
    name: sampleCategories[0]!.name,
    kind: null,
  },
  beneficiary: {
    id: sampleBeneficiaries[0]!.id,
    name: sampleBeneficiaries[0]!.name,
    kind: 'HOUSEHOLD',
  },
  createdBy: {
    userId: sampleUser.id,
    displayName: sampleUser.displayName,
  },
  recordedAt: '2026-10-19T10:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canReplace: true, canVoid: true },
}

const refreshedDashboard = {
  ...sampleDashboard,
  totalBalance: '1190',
  overview: {
    ...sampleDashboard.overview,
    expense: '360',
    net: '140',
  },
  recentActivity: [
    {
      id: createdExpense.id,
      kind: 'EXPENSE',
      effectiveDate: createdExpense.effectiveDate,
      amount: createdExpense.amount,
      currency: createdExpense.currency,
      note: createdExpense.note,
      recordedAt: createdExpense.recordedAt,
      account: {
        id: sampleAccounts[0]!.id,
        name: sampleAccounts[0]!.name,
      },
      sourceAccount: null,
      destinationAccount: null,
    },
    ...sampleDashboard.recentActivity,
  ],
}

type QuickAddOptions = {
  hangCreate?: boolean
  failCreate?: boolean
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockQuickAddSession(
  page: Page,
  options: QuickAddOptions = {},
): Promise<{
  createBodies: unknown[]
  expenseListGets: number
  categoryStatuses: Array<string | null>
  beneficiaryStatuses: Array<string | null>
}> {
  const householdId = sampleHousehold.id
  const createBodies: unknown[] = []
  let expenseListGets = 0
  const categoryStatuses: Array<string | null> = []
  const beneficiaryStatuses: Array<string | null> = []
  let created = false

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const { pathname } = url

    if (pathname === '/api/v1/auth/activity' && method === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }

    if (pathname === '/api/v1/auth/csrf' && method === 'GET') {
      await json(route, { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' })
      return
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      await json(route, sampleUser)
      return
    }

    if (pathname === '/api/v1/household' && method === 'GET') {
      await json(route, sampleHousehold)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/reports/dashboard` &&
      method === 'GET'
    ) {
      await json(route, created ? refreshedDashboard : sampleDashboard)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/accounts` &&
      method === 'GET'
    ) {
      await json(route, [...sampleAccounts, archivedAccount])
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/categories` &&
      method === 'GET'
    ) {
      categoryStatuses.push(url.searchParams.get('status'))
      await json(route, sampleCategories)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/beneficiaries` &&
      method === 'GET'
    ) {
      beneficiaryStatuses.push(url.searchParams.get('status'))
      await json(route, sampleBeneficiaries)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/expenses` &&
      method === 'GET'
    ) {
      expenseListGets += 1
      await json(route, { detail: 'Dashboard create must not list expenses' }, 404)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/expenses` &&
      method === 'POST'
    ) {
      createBodies.push(request.postDataJSON())
      if (options.hangCreate) {
        await new Promise(() => {})
        return
      }
      if (options.failCreate) {
        await json(route, { detail: 'INVALID_MONEY' }, 400)
        return
      }
      created = true
      await json(route, createdExpense)
      return
    }

    await json(
      route,
      { detail: `Unhandled mock ${method} ${pathname}` },
      method === 'GET' ? 404 : 405,
    )
  })

  return {
    createBodies,
    get expenseListGets() {
      return expenseListGets
    },
    categoryStatuses,
    beneficiaryStatuses,
  }
}

async function assertOpenDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Add expense' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
  await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
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
  return dialog
}

async function fillQuickAdd(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Add expense' })
  await dialog.getByLabel('Date').fill('2026-10-19')
  await dialog.getByLabel(/Amount/).fill('10')
  await dialog.getByLabel('Note').fill('Market')
  return dialog
}

test.describe('dashboard quick add', () => {
  test('stays on / through open, cancel, and a successful write', async ({
    page,
  }) => {
    const session = await mockQuickAddSession(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.getByText('1,200 MMK')).toBeVisible()
    await expect(page).toHaveURL('/')

    await page.getByRole('button', { name: 'Add expense' }).click()
    const dialog = await assertOpenDialog(page)
    await expect(page).toHaveURL('/')
    await expect(dialog.getByRole('option', { name: 'Cash' })).toBeAttached()
    await expect(dialog.getByRole('option', { name: 'Old cash' })).toHaveCount(0)
    expect(session.categoryStatuses).toEqual(['ACTIVE'])
    expect(session.beneficiaryStatuses).toEqual(['ACTIVE'])
    expect(session.expenseListGets).toBe(0)

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Add expense' })).toBeFocused()

    await page.getByRole('button', { name: 'Add expense' }).click()
    await assertOpenDialog(page)
    await fillQuickAdd(page)
    await page.getByRole('button', { name: 'Save expense' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL('/')
    await expect(page.getByText('1,190 MMK')).toBeVisible()
    await expect(page.getByText('Market')).toBeVisible()
    expect(session.createBodies).toEqual([
      {
        effectiveDate: '2026-10-19',
        amount: '10',
        accountId: sampleAccounts[0]!.id,
        categoryId: sampleCategories[0]!.id,
        beneficiaryId: sampleBeneficiaries[0]!.id,
        note: 'Market',
      },
    ])
    expect(session.expenseListGets).toBe(0)
    expect(session.categoryStatuses).toEqual(['ACTIVE', 'ACTIVE'])
    expect(session.beneficiaryStatuses).toEqual(['ACTIVE', 'ACTIVE'])
  })

  test('keeps field values after a failed write and stays on /', async ({
    page,
  }) => {
    await mockQuickAddSession(page, { failCreate: true })
    await page.goto('/')
    await page.getByRole('button', { name: 'Add expense' }).click()
    const dialog = await fillQuickAdd(page)
    await dialog.getByRole('button', { name: 'Save expense' }).click()

    await expect(dialog.getByText('Could not save')).toBeVisible()
    await expect(dialog.getByLabel(/Amount/)).toHaveValue('10')
    await expect(dialog.getByLabel('Note')).toHaveValue('Market')
    await expect(page).toHaveURL('/')
  })

  test('blocks dismiss while saving and keeps a short mobile dialog in view', async ({
    page,
  }) => {
    await mockQuickAddSession(page, { hangCreate: true })
    await page.setViewportSize({ width: 390, height: 667 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Add expense' }).click()

    const dialog = await assertOpenDialog(page)
    await fillQuickAdd(page)
    const submit = dialog.getByRole('button', { name: 'Save expense' })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeVisible()
    await submit.click()

    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.locator('[data-slot="dialog-overlay"]').click({
      position: { x: 2, y: 2 },
      force: true,
    })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL('/')
    await assertOpenDialog(page)
  })
})
