import type { Page, Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleBeneficiaries,
  sampleCategories,
  sampleDashboard,
  sampleExpenses,
  sampleHousehold,
  sampleUser,
} from './mocks'

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/**
 * Installs same-origin API mocks for an authenticated household session.
 * Call before `page.goto` so the auth bootstrap and page loads succeed.
 */
export async function mockAuthenticatedSession(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') {
      await json(route, { detail: 'Mocked API is read-only in e2e' }, 405)
      return
    }

    const { pathname } = new URL(request.url())
    const householdId = sampleHousehold.id

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

    if (pathname === `/api/v1/households/${householdId}/expenses`) {
      await json(route, sampleExpenses)
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

    await json(route, { detail: `Unhandled mock path: ${pathname}` }, 404)
  })
}
