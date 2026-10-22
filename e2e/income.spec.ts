import { expect, test, type Page, type Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleBeneficiaries,
  sampleDashboard,
  sampleHousehold,
  sampleUser,
} from './fixtures/mocks'

const cashId = sampleAccounts[0]!.id
const beneficiary = sampleBeneficiaries[0]!

const postedIncome = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  kind: 'INCOME',
  state: 'POSTED',
  effectiveDate: '2026-10-22',
  amount: '400',
  currency: 'MMK',
  note: 'Salary',
  account: {
    id: cashId,
    name: sampleAccounts[0]!.name,
    kind: null,
  },
  beneficiary: {
    id: beneficiary.id,
    name: beneficiary.name,
    kind: beneficiary.kind,
  },
  createdBy: {
    userId: sampleUser.id,
    displayName: sampleUser.displayName,
  },
  recordedAt: '2026-10-22T04:00:00Z',
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

function addWhole(left: string, right: string): string {
  return (BigInt(left) + BigInt(right)).toString()
}

function subtractWhole(left: string, right: string): string {
  return (BigInt(left) - BigInt(right)).toString()
}

async function mockIncomeSession(page: Page): Promise<void> {
  let accounts = structuredClone(sampleAccounts)
  let incomes: Array<typeof postedIncome> = []
  const createdByKey = new Map<string, typeof postedIncome>()
  const householdId = sampleHousehold.id

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
      await json(route, sampleUser)
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
    if (
      pathname === `/api/v1/households/${householdId}/accounts` &&
      method === 'GET'
    ) {
      await json(route, accounts)
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
      pathname === `/api/v1/households/${householdId}/incomes` &&
      method === 'GET'
    ) {
      await json(
        route,
        incomes.filter((row) => row.state === 'POSTED'),
      )
      return
    }
    if (
      pathname === `/api/v1/households/${householdId}/incomes` &&
      method === 'POST'
    ) {
      const csrf = request.headers()['x-csrf-token']
      const key = request.headers()['idempotency-key']
      const payload = request.postDataJSON() as {
        effectiveDate?: string
        amount?: string
        accountId?: string
        beneficiaryId?: string
        note?: string
      }
      expect(csrf).toBe('e2e-csrf')
      expect(key).toBeTruthy()
      expect(payload.accountId).toBe(cashId)
      expect(payload.beneficiaryId).toBe(beneficiary.id)
      expect(payload.amount).toMatch(/^[1-9]\d*$/)
      expect(payload.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      if (key && createdByKey.has(key)) {
        await json(route, createdByKey.get(key), 200)
        return
      }

      const created = {
        ...postedIncome,
        effectiveDate: payload.effectiveDate ?? postedIncome.effectiveDate,
        amount: payload.amount ?? postedIncome.amount,
        note: payload.note ?? null,
      }
      incomes = [created]
      accounts = accounts.map((row) =>
        row.id === cashId
          ? {
              ...row,
              currentBalance: addWhole(row.currentBalance, created.amount),
            }
          : row,
      )
      if (key) {
        createdByKey.set(key, created)
      }
      await json(route, created, 201)
      return
    }

    const detailMatch = pathname.match(
      new RegExp(`^/api/v1/households/${householdId}/incomes/([0-9a-f-]+)$`),
    )
    if (detailMatch && method === 'GET') {
      const row = incomes.find((item) => item.id === detailMatch[1])
      await json(route, row ?? { detail: 'Not found' }, row ? 200 : 404)
      return
    }

    const voidMatch = pathname.match(
      new RegExp(
        `^/api/v1/households/${householdId}/incomes/([0-9a-f-]+)/void$`,
      ),
    )
    if (voidMatch && method === 'POST') {
      const csrf = request.headers()['x-csrf-token']
      const key = request.headers()['idempotency-key']
      const ifMatch = request.headers()['if-match']
      const payload = request.postDataJSON() as { reason?: string }
      const current = incomes.find((item) => item.id === voidMatch[1])
      expect(csrf).toBe('e2e-csrf')
      expect(key).toBeTruthy()
      expect(ifMatch).toBe(`"${current?.version ?? 0}"`)
      expect(payload.reason?.trim()).toBeTruthy()

      const voided = {
        ...postedIncome,
        ...current,
        state: 'VOID',
        version: (current?.version ?? 0) + 1,
        capabilities: { canVoid: false },
      }
      incomes = incomes.map((row) => (row.id === voided.id ? voided : row))
      accounts = accounts.map((row) =>
        row.id === cashId
          ? {
              ...row,
              currentBalance: subtractWhole(
                row.currentBalance,
                voided.amount,
              ),
            }
          : row,
      )
      await json(route, voided)
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

test.describe('income', () => {
  test('member creates and voids income through nav and updates balances', async ({
    page,
  }) => {
    await mockIncomeSession(page)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Incomes' }).click()
    await expect(page).toHaveURL(/\/incomes/)
    await expect(
      page.getByRole('heading', { name: 'Incomes', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('No posted income yet.')).toBeVisible()

    await page.getByRole('button', { name: 'Add income' }).click()
    const create = page.getByRole('dialog', { name: 'Add income' })
    await expect(create).toBeVisible()
    await expect(create).toHaveAttribute('data-slot', 'dialog-content')
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)

    await create.getByLabel(/Amount/).fill('400')
    await create.getByLabel('Note').fill('Salary')
    await create.getByRole('button', { name: 'Save income' }).click()

    await expect(page.getByText('Salary')).toBeVisible()
    await expect(create).toHaveCount(0)

    await page.getByRole('link', { name: 'Accounts' }).click()
    await expect(page.getByText('1,650 MMK')).toBeVisible()

    await page.getByRole('link', { name: 'Incomes' }).click()
    await page.getByRole('button', { name: 'View' }).click()
    const detail = page.getByRole('dialog', { name: 'Income details' })
    await expect(detail).toBeVisible()
    await expect(detail).toHaveAttribute('data-slot', 'dialog-content')
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
    await detail.getByLabel('Void reason').fill('Entered twice')
    await detail.getByRole('button', { name: 'Void income' }).click()

    await expect(page.getByText('No posted income yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Accounts' }).click()
    await expect(page.getByText('1,250 MMK')).toBeVisible()
  })

  test('create dialog fits a short mobile viewport and is not a sheet', async ({
    page,
  }) => {
    await mockIncomeSession(page)
    await page.setViewportSize({ width: 390, height: 667 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('link', { name: 'Incomes' }).click()
    await expect(
      page.getByRole('heading', { name: 'Incomes', level: 1 }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Add income' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add income' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
    const submit = dialog.getByRole('button', { name: 'Save income' })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeVisible()
    await assertDialogFitsViewport(page)
  })
})
