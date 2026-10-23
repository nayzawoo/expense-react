import { expect, test } from '@playwright/test'

import { mockAuthenticatedSession } from './fixtures/auth'
import { sampleAccounts, sampleCategories, sampleExpenses } from './fixtures/mocks'

test('mobile expense log shows all details in date groups and filters the grouped records', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Household is already on October 23 while UTC is still October 22.
  await page.clock.setFixedTime(new Date('2026-10-22T19:00:00Z'))
  await mockAuthenticatedSession(page)
  const rows = [
    { ...sampleExpenses[0]!, id: 'older', effectiveDate: '2026-10-20', note: 'Older receipt' },
    { ...sampleExpenses[0]!, id: 'today-first', effectiveDate: '2026-10-23', note: 'Detailed receipt ' + 'long-reference-'.repeat(15) },
    { ...sampleExpenses[0]!, id: 'today-second', effectiveDate: '2026-10-23', note: 'Second receipt' },
  ]
  await page.route('**/api/v1/households/*/expenses', route => route.fulfill({ json: rows }))
  await page.goto('/expenses')

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '20-10-2026 (Tue)', exact: true })).toBeVisible()
  const headings = page.getByRole('heading', { level: 3 })
  await expect(headings).toHaveText(['Today', '20-10-2026 (Tue)'])
  const record = page.getByRole('row').filter({ hasText: 'Detailed receipt' })
  for (const label of ['Amount', 'Account', 'Category', 'Beneficiary', 'Note', 'Recorded by']) {
    await expect(record.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(record.getByText(rows[1]!.account.name, { exact: true })).toBeVisible()
  await expect(record.getByText(rows[1]!.beneficiary.name, { exact: true })).toBeVisible()
  await expect(record.getByText(rows[1]!.createdBy.displayName, { exact: true })).toBeVisible()
  await expect(record.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(await record.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

  await page.getByLabel('Search', { exact: true }).fill('Older receipt')
  await expect(headings).toHaveText(['20-10-2026 (Tue)'])
  await expect(page.getByText('Second receipt')).toHaveCount(0)
  await page.getByRole('row').filter({ hasText: 'Older receipt' }).getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Edit expense', exact: true })).toBeVisible()
})

test('archived category styling remains available in history but is excluded from new expenses', async ({ page }) => {
  await mockAuthenticatedSession(page)
  const archived = { ...sampleCategories[0]!, id: 'archived-category', name: 'Old transport', status: 'ARCHIVED', iconKey: 'transport', color: '#123456' }
  await page.route('**/api/v1/households/*/categories**', route => route.fulfill({ json: [...sampleCategories, archived] }))
  await page.route('**/api/v1/households/*/expenses', route => route.fulfill({ json: [
    { ...sampleExpenses[0]!, category: { id: archived.id, name: archived.name, kind: null } },
  ] }))
  await page.goto('/expenses')
  const record = page.getByRole('row').filter({ hasText: 'Groceries' })
  const category = record.getByText(archived.name, { exact: true }).locator('..')
  await expect(category.locator('svg')).toHaveCSS('color', 'rgb(18, 52, 86)')
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add expense', exact: true })
  const options = dialog.getByLabel('Category', { exact: true }).getByRole('option')
  await expect(options).toHaveText(sampleCategories.map(row => row.name))
})

test('same-name accounts show the correct owner in records and filters, including archived history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAuthenticatedSession(page)
  const accounts = [
    { ...sampleAccounts[0]!, id: 'kpay-nzo', name: 'KPay', ownerLabel: 'NZO', type: 'WALLET' },
    { ...sampleAccounts[0]!, id: 'kpay-atda', name: 'KPay', ownerLabel: 'ATDA', type: 'WALLET', status: 'ARCHIVED' },
  ]
  const rows = accounts.map((account, index) => ({
    ...sampleExpenses[0]!, id: `expense-${index}`, note: `Receipt ${index}`,
    account: { id: account.id, name: account.name, kind: account.type },
  }))
  await page.route('**/api/v1/households/*/accounts', route => route.fulfill({ json: accounts }))
  await page.route('**/api/v1/households/*/expenses', route => route.fulfill({ json: rows }))
  await page.goto('/expenses')

  const filter = page.getByLabel('Account', { exact: true })
  await expect(filter.getByRole('option')).toHaveText(['All accounts', 'KPay (NZO)', 'KPay (ATDA)'])
  await expect(page.getByRole('row').filter({ hasText: 'Receipt 0' }).getByText('NZO', { exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Receipt 1' }).getByText('ATDA', { exact: true })).toBeVisible()
  await filter.selectOption('kpay-atda')
  await expect(page.getByText('Receipt 0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Receipt 1', { exact: true })).toBeVisible()
  await filter.selectOption('all')
  await page.getByLabel('Search', { exact: true }).fill('ATDA')
  await expect(page.getByText('Receipt 0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Receipt 1', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add expense', exact: true })
  await expect(dialog.getByLabel('Account', { exact: true }).getByRole('option')).toHaveCount(1)
})
