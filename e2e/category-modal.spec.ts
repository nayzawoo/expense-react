import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Isolated category modal coverage. Local synthetic fixtures and route
 * overrides only; no live credentials or backend calls.
 */

const household = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sample Household',
  currency: 'MMK',
  currencyScale: 0,
  timezone: 'Asia/Yangon',
}

const memberUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.com',
  displayName: 'Sample Member',
  role: 'MEMBER',
  mustChangePassword: false,
}

const adminUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  displayName: 'Sample Admin',
  role: 'ADMIN',
  mustChangePassword: false,
}

type CategoryRow = {
  id: string
  name: string
  color: string
  iconKey: string
  sortOrder: number
  status: string
  version: number
}

const groceries: CategoryRow = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Groceries',
  color: '#AABBCC',
  iconKey: 'food',
  sortOrder: 1,
  status: 'ACTIVE',
  version: 0,
}

const commute: CategoryRow = {
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Commute',
  color: '#112233',
  iconKey: 'transport',
  sortOrder: 2,
  status: 'ACTIVE',
  version: 0,
}

const ICON_LABELS = [
  'Food',
  'Transport',
  'Home',
  'Health',
  'Shopping',
  'Bills',
  'Education',
  'Entertainment',
  'Other',
]

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockCategorySession(
  page: Page,
  role: 'ADMIN' | 'MEMBER',
): Promise<{
  creates: Array<Record<string, unknown>>
  updates: Array<{ id: string; body: Record<string, unknown> }>
}> {
  const user = role === 'ADMIN' ? adminUser : memberUser
  let categories: CategoryRow[] = [groceries, commute]
  const creates: Array<Record<string, unknown>> = []
  const updates: Array<{ id: string; body: Record<string, unknown> }> = []
  const householdId = household.id

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
      await json(route, user)
      return
    }

    if (pathname === '/api/v1/household' && method === 'GET') {
      await json(route, household)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/categories` &&
      method === 'GET'
    ) {
      await json(route, categories)
      return
    }

    if (
      pathname === `/api/v1/households/${householdId}/categories` &&
      method === 'POST'
    ) {
      const body = JSON.parse(request.postData() ?? '{}') as Record<
        string,
        unknown
      >
      creates.push(body)
      const created: CategoryRow = {
        id: '88888888-8888-4888-8888-888888888888',
        name: String(body.name ?? ''),
        color: String(body.color ?? ''),
        iconKey: String(body.iconKey ?? ''),
        sortOrder: Number(body.sortOrder ?? 0),
        status: 'ACTIVE',
        version: 0,
      }
      categories = [...categories, created]
      await json(route, created)
      return
    }

    const updateMatch = pathname.match(
      new RegExp(
        `^/api/v1/households/${householdId}/categories/([0-9a-f-]+)$`,
      ),
    )
    if (updateMatch && method === 'PUT') {
      const body = JSON.parse(request.postData() ?? '{}') as Record<
        string,
        unknown
      >
      const id = updateMatch[1]!
      updates.push({ id, body })
      categories = categories.map((row) =>
        row.id === id
          ? {
              ...row,
              name: String(body.name ?? row.name),
              color: String(body.color ?? row.color),
              iconKey: String(body.iconKey ?? row.iconKey),
              sortOrder: Number(body.sortOrder ?? row.sortOrder),
              version: row.version + 1,
            }
          : row,
      )
      const updated = categories.find((row) => row.id === id)
      await json(route, updated)
      return
    }

    if (method !== 'GET') {
      await json(route, { detail: 'Mocked API is read-only here' }, 405)
      return
    }

    await json(route, { detail: `Unhandled mock path: ${pathname}` }, 404)
  })

  return { creates, updates }
}

async function assertNoVisibleIconNames(page: Page): Promise<void> {
  for (const label of ICON_LABELS) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0)
  }
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

test.describe('category modal', () => {
  test('members cannot mutate categories', async ({ page }) => {
    await mockCategorySession(page, 'MEMBER')
    await page.goto('/categories')

    await expect(
      page.getByRole('heading', { name: 'Categories', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Groceries')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add category' })).toHaveCount(
      0,
    )
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
    await assertNoVisibleIconNames(page)
  })

  test('admin create/edit uses a centered modal, icon picker, and exact iconKey', async ({
    page,
  }) => {
    const { creates, updates } = await mockCategorySession(page, 'ADMIN')
    await page.goto('/categories')

    await expect(page.getByText('Groceries')).toBeVisible()
    await page.getByRole('button', { name: 'Add category' }).click()

    const form = page.getByRole('dialog', { name: 'Add category' })
    await expect(form).toBeVisible()
    await expect(form).toHaveAttribute('data-slot', 'dialog-content')
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
    await assertDialogFitsViewport(page)
    await assertNoVisibleIconNames(page)

    const trigger = form.getByRole('button', { name: /Choose icon/ })
    await trigger.press('Enter')
    const picker = page.getByRole('dialog', { name: 'Choose an icon' })
    await expect(picker).toBeVisible()
    await expect(picker).toHaveAttribute('data-category-icon-picker', '')
    await expect(
      picker.getByRole('button', { name: 'Other' }),
    ).toHaveAttribute('data-selected', 'true')
    await assertNoVisibleIconNames(page)

    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute('data-icon-key', 'other')

    await trigger.click()
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: 'Cancel' }).click()
    await expect(picker).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute('data-icon-key', 'other')

    await trigger.click()
    await picker.getByRole('button', { name: 'Health' }).click()
    await expect(picker).toBeHidden()
    await expect(form.getByRole('button', { name: /Choose icon \(Health\)/ })).toHaveAttribute(
      'data-icon-key',
      'health',
    )

    await form.getByLabel('Name').fill('Clinic')
    await form.getByLabel('Color hex').fill('#22AA66')
    await form.getByRole('button', { name: 'Save category' }).click()
    await expect(page.getByText('Clinic')).toBeVisible()
    expect(creates).toEqual([
      {
        name: 'Clinic',
        color: '#22AA66',
        iconKey: 'health',
        sortOrder: 3,
      },
    ])

    const groceriesRow = page.getByRole('row').filter({ hasText: 'Groceries' })
    await groceriesRow.getByRole('button', { name: 'Edit' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit category' })
    await expect(edit).toBeVisible()
    await expect(edit).toHaveAttribute('data-slot', 'dialog-content')
    await expect(
      edit.getByRole('button', { name: /Choose icon \(Food\)/ }),
    ).toHaveAttribute('data-icon-key', 'food')

    await edit.getByRole('button', { name: /Choose icon/ }).click()
    const editPicker = page.getByRole('dialog', { name: 'Choose an icon' })
    await expect(
      editPicker.getByRole('button', { name: 'Food' }),
    ).toHaveAttribute('data-selected', 'true')
    await editPicker.getByRole('button', { name: 'Shopping' }).click()
    await edit.getByRole('button', { name: 'Save changes' }).click()

    await expect(
      page.getByRole('dialog', { name: 'Edit category' }),
    ).toHaveCount(0)
    expect(updates).toEqual([
      {
        id: groceries.id,
        body: {
          name: 'Groceries',
          color: '#AABBCC',
          iconKey: 'shopping',
          sortOrder: 1,
        },
      },
    ])
  })

  test('category modal fits a mobile viewport and stays scrollable', async ({
    page,
  }) => {
    await mockCategorySession(page, 'ADMIN')
    await page.setViewportSize({ width: 390, height: 667 })
    await page.goto('/categories')

    await expect(page.getByText('Groceries')).toBeVisible()
    await page.getByRole('button', { name: 'Add category' }).click()
    const form = page.getByRole('dialog', { name: 'Add category' })
    await expect(form).toBeVisible()
    await expect(form).toHaveAttribute('data-slot', 'dialog-content')
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
    await assertDialogFitsViewport(page)

    await form.getByRole('button', { name: /Choose icon/ }).click()
    const picker = page.getByRole('dialog', { name: 'Choose an icon' })
    await expect(picker).toBeVisible()
    const pickerBox = await picker.boundingBox()
    const viewport = page.viewportSize()
    expect(pickerBox).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(pickerBox!.y).toBeGreaterThanOrEqual(-1)
    expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(
      viewport!.height + 1,
    )
    await expect(picker.getByRole('button', { name: 'Health' })).toBeVisible()
  })
})
