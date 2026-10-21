import type { Page, Route } from '@playwright/test'

import {
  sampleAccounts,
  sampleAnalytics,
  sampleAnalyticsAsOfSeptember,
  sampleBeneficiaries,
  sampleCategories,
  sampleDashboard,
  sampleExpenses,
  sampleHousehold,
  sampleUser,
} from './mocks'

type MockSessionOptions = {
  analytics?: typeof sampleAnalytics
  dashboard?: typeof sampleDashboard
}

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
export async function mockAuthenticatedSession(
  page: Page,
  options: MockSessionOptions = {},
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const { pathname } = new URL(request.url())
    const householdId = sampleHousehold.id

    if (pathname === '/api/v1/auth/activity' && method === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }

    if (method !== 'GET') {
      await json(route, { detail: 'Mocked API is read-only in e2e' }, 405)
      return
    }

    if (pathname === '/api/v1/auth/csrf') {
      await json(route, {
        token: 'test-csrf',
        headerName: 'X-CSRF-TOKEN',
      })
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
      await json(route, options.dashboard ?? sampleDashboard)
      return
    }

    if (pathname === `/api/v1/households/${householdId}/reports/analytics`) {
      const asOf = new URL(request.url()).searchParams.get('asOf')
      await json(
        route,
        asOf === '2026-09-30'
          ? sampleAnalyticsAsOfSeptember
          : (options.analytics ?? sampleAnalytics),
      )
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
