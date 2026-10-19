import { expect, test } from '@playwright/test'

test.describe('smoke', () => {
  test('app boots and sends guests to the login page', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: 'Sign in', level: 1 }),
    ).toBeVisible()
  })

  test('login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login')

    await expect(
      page.getByRole('heading', { name: 'Sign in', level: 1 }),
    ).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})
