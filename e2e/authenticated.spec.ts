import { expect, test } from '@playwright/test'

import { mockAuthenticatedSession } from './fixtures/auth'

test.describe('authenticated smokes (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page)
  })

  test('mocked session reaches the dashboard', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Signed in as Sample Member')).toBeVisible()
    await expect(page.getByText('1,200 MMK')).toBeVisible()
    await expect(page.getByText('Groceries')).toBeVisible()
  })

  test('mocked session reaches the expenses list', async ({ page }) => {
    await page.goto('/expenses')

    await expect(page).toHaveURL(/\/expenses/)
    await expect(
      page.getByRole('heading', { name: 'Expenses', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Sample Household · MMK')).toBeVisible()
    await expect(page.getByText('2026-10-18')).toBeVisible()
    await expect(page.getByText('50 MMK')).toBeVisible()
    await expect(page.getByText('Groceries')).toBeVisible()
  })
})
