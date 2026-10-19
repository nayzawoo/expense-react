import { expect, test, type Page, type Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleBeneficiaries,
  sampleCategories,
  sampleDashboard,
  sampleExpenses,
  sampleHousehold,
  sampleUser,
} from './fixtures/mocks'

const createdExpense = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  kind: 'EXPENSE',
  state: 'POSTED',
  effectiveDate: '2026-10-19',
  amount: '10',
  currency: 'MMK',
  note: null,
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

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockLostCreateThenReplay(page: Page): Promise<{
  seenKeys: string[]
  committed: Map<string, typeof createdExpense>
}> {
  const seenKeys: string[] = []
  const committed = new Map<string, typeof createdExpense>()
  let loseNextCreate = true
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
    if (pathname === `/api/v1/households/${householdId}/accounts`) {
      await json(route, sampleAccounts)
      return
    }
    if (pathname === `/api/v1/households/${householdId}/categories`) {
      await json(route, sampleCategories)
      return
    }
    if (pathname === `/api/v1/households/${householdId}/beneficiaries`) {
      await json(route, sampleBeneficiaries)
      return
    }
    if (pathname === `/api/v1/households/${householdId}/expenses`) {
      if (method === 'GET') {
        await json(route, [...sampleExpenses, ...committed.values()])
        return
      }
      if (method === 'POST') {
        const key = request.headers()['idempotency-key']
        if (key) {
          seenKeys.push(key)
          if (!committed.has(key)) {
            committed.set(key, createdExpense)
          }
        }
        if (loseNextCreate) {
          loseNextCreate = false
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: `{"id":"${createdExpense.id}","amount":`,
          })
          return
        }
        await json(route, committed.get(key ?? '') ?? createdExpense)
        return
      }
    }

    await json(
      route,
      { detail: `Unhandled mock ${method} ${pathname}` },
      method === 'GET' ? 404 : 405,
    )
  })

  return { seenKeys, committed }
}

async function submitSyntheticExpense(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add expense' }).click()
  await page.getByLabel('Date').fill('2026-10-19')
  await page.getByLabel(/Amount/).fill('10')
  await page.getByRole('button', { name: 'Save expense' }).click()
}

test.describe('expense create retry after lost response', () => {
  test('reuses the original Idempotency-Key after reload', async ({ page }) => {
    const { seenKeys, committed } = await mockLostCreateThenReplay(page)

    await page.goto('/expenses')
    await expect(page.getByRole('heading', { name: 'Expenses', level: 1 })).toBeVisible()

    await submitSyntheticExpense(page)
    await expect(page.getByText('Could not save')).toBeVisible()
    expect(seenKeys).toHaveLength(1)
    expect(committed.size).toBe(1)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Expenses', level: 1 })).toBeVisible()

    await submitSyntheticExpense(page)
    await expect(page.getByText('Created successfully.')).toBeVisible()
    await expect(page.getByText('10 MMK')).toBeVisible()

    expect(seenKeys).toHaveLength(2)
    expect(seenKeys[0]).toBeTruthy()
    expect(seenKeys[1]).toBe(seenKeys[0])
    expect(committed.size).toBe(1)
  })
})
