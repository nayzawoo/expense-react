import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

import { mockAuthenticatedSession } from './fixtures/auth'
import { analyticsWithManyCategories } from './fixtures/mocks'

const screenshotDir = '/tmp/expense-react-chart-screenshots'
const desktop = { width: 1280, height: 720 }
const mobile = { width: 390, height: 844 }
const octoberTicks = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const septemberTicks = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']

function chartRoot(page: Page, chart: string) {
  return page.locator(`[data-chart="${chart}"]`)
}

function chartSurface(page: Page, chart: string) {
  return page.locator(
    `[data-chart="${chart}"] svg.recharts-surface[role="application"]`,
  )
}

async function dismissTooltips(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page
    .locator('[data-chart-tooltip="true"]')
    .waitFor({ state: 'hidden' })
    .catch(() => undefined)
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  await dismissTooltips(page)
  const overflowing = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    )
  })
  expect(overflowing).toBe(false)
}

type ChartMetrics = {
  svgWidth: number
  containerWidth: number
  attrWidth: number
  svgLeft: number
  svgRight: number
  bars: Array<{ left: number; right: number; height: number }>
  ticks: Array<{ text: string; left: number; right: number }>
}

async function readChartMetrics(
  page: Page,
  chart: string,
): Promise<ChartMetrics | null> {
  return page.evaluate((name) => {
    const root = document.querySelector(`[data-chart="${name}"]`)
    if (!root) {
      return null
    }
    const svg = root.querySelector(
      'svg.recharts-surface[role="application"]',
    ) as SVGElement | null
    const container =
      root.querySelector('[data-chart-viewport="true"]') ??
      root.querySelector('.recharts-responsive-container')
    if (!svg || !container) {
      return null
    }
    const svgBox = svg.getBoundingClientRect()
    const containerBox = container.getBoundingClientRect()
    const attrWidth = Number(svg.getAttribute('width'))
    const bars = [...svg.querySelectorAll('path.recharts-rectangle, rect.recharts-rectangle')]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0.5 && box.height > 0.5)
      .map((box) => ({
        left: box.left,
        right: box.right,
        height: box.height,
      }))
    const ticks = [...svg.querySelectorAll('text, tspan')]
      .map((element) => {
        const box = element.getBoundingClientRect()
        return {
          text: (element.textContent ?? '').trim(),
          left: box.left,
          right: box.right,
        }
      })
      .filter((tick) => tick.text.length > 0)
    return {
      svgWidth: svgBox.width,
      containerWidth: containerBox.width,
      attrWidth: Number.isFinite(attrWidth) ? attrWidth : svgBox.width,
      svgLeft: svgBox.left,
      svgRight: svgBox.right,
      bars,
      ticks,
    }
  }, chart)
}

function chartFitsContainer(metrics: ChartMetrics): boolean {
  if (metrics.containerWidth < 40) {
    return false
  }
  const widthMatches =
    Math.abs(metrics.svgWidth - metrics.containerWidth) <= 3 &&
    Math.abs(metrics.attrWidth - metrics.containerWidth) <= 3
  const barsInside = metrics.bars.every(
    (bar) =>
      bar.left >= metrics.svgLeft - 2 && bar.right <= metrics.svgRight + 2,
  )
  return widthMatches && barsInside
}

async function waitForChartToFit(page: Page, chart: string): Promise<void> {
  await expect(chartSurface(page, chart)).toBeVisible()
  await expect
    .poll(
      async () => {
        const metrics = await readChartMetrics(page, chart)
        return metrics != null && chartFitsContainer(metrics)
      },
      { timeout: 8_000 },
    )
    .toBe(true)
}

async function waitForMonthlyChartToFit(
  page: Page,
  tickLabels: string[],
): Promise<void> {
  const chart = chartRoot(page, 'monthly-trend')
  await waitForChartToFit(page, 'monthly-trend')
  for (const label of tickLabels) {
    await expect(chart.getByText(label, { exact: true }).first()).toBeVisible()
  }
  await expect
    .poll(
      async () => {
        const metrics = await readChartMetrics(page, 'monthly-trend')
        if (metrics == null || !chartFitsContainer(metrics)) {
          return false
        }
        const uniqueBarLefts = new Set(
          metrics.bars.map((bar) => Math.round(bar.left)),
        )
        if (uniqueBarLefts.size < tickLabels.length - 1) {
          return false
        }
        const labelBoxes = await Promise.all(
          tickLabels.map((label) =>
            chart.getByText(label, { exact: true }).first().boundingBox(),
          ),
        )
        return labelBoxes.every(
          (box) =>
            box != null &&
            box.x >= metrics.svgLeft - 8 &&
            box.x + box.width <= metrics.svgRight + 8,
        )
      },
      { timeout: 8_000 },
    )
    .toBe(true)
}

async function waitForVisibleChartsToFit(page: Page): Promise<void> {
  const names = await page.locator('[data-chart]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-chart'))
      .filter((name): name is string => Boolean(name)),
  )
  for (const name of names) {
    if (await chartSurface(page, name).isVisible()) {
      await waitForChartToFit(page, name)
    }
  }
}

async function resizeAndWait(
  page: Page,
  size: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(size)
  await waitForVisibleChartsToFit(page)
  await assertNoHorizontalOverflow(page)
}

async function captureReviewScreenshot(
  page: Page,
  fileName: string,
): Promise<void> {
  await dismissTooltips(page)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.querySelectorAll('header, aside').forEach((element) => {
      ;(element as HTMLElement).style.setProperty(
        'position',
        'static',
        'important',
      )
    })
  })
  await waitForVisibleChartsToFit(page)
  await page.screenshot({
    path: `${screenshotDir}/${fileName}`,
    fullPage: true,
  })
}

async function openTooltipNearItem(page: Page, chart: string): Promise<void> {
  const root = chartRoot(page, chart)
  const target = root
    .locator(
      '.recharts-rectangle, .recharts-bar-rectangle, .recharts-pie-sector, .recharts-dot',
    )
    .last()
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()
  const itemBox = await target.boundingBox()
  await target.hover({ force: true })
  const tooltip = page.locator('[data-chart-tooltip="true"]').first()
  await expect(tooltip).toBeVisible()
  const tipBox = await tooltip.boundingBox()
  expect(itemBox).toBeTruthy()
  expect(tipBox).toBeTruthy()
  if (itemBox && tipBox) {
    const dx = Math.abs(
      tipBox.x + tipBox.width / 2 - (itemBox.x + itemBox.width / 2),
    )
    const dy = Math.abs(
      tipBox.y + tipBox.height / 2 - (itemBox.y + itemBox.height / 2),
    )
    expect(dx < 220 || dy < 160).toBeTruthy()
  }
}

test.describe('report charts (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(screenshotDir, { recursive: true })
    await mockAuthenticatedSession(page)
  })

  test('dashboard and reports render Recharts SVGs with inspectable values', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
    })
    page.on('response', (response) => {
      if (response.status() !== 404) {
        return
      }
      const path = new URL(response.url()).pathname
      if (path.startsWith('/api/')) {
        consoleErrors.push(`API 404 ${path}`)
      }
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') {
        return
      }
      const text = message.text()
      if (text.includes('Failed to load resource') && text.includes('404')) {
        return
      }
      consoleErrors.push(text)
    })

    await page.setViewportSize(desktop)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible()
    await waitForVisibleChartsToFit(page)
    await openTooltipNearItem(page, 'income-expense')
    await expect(
      page.locator('[data-chart-tooltip="true"]').filter({ hasText: 'MMK' }),
    ).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await captureReviewScreenshot(page, 'dashboard-desktop-light.png')

    await resizeAndWait(page, mobile)
    await captureReviewScreenshot(page, 'dashboard-mobile-light.png')

    await page.setViewportSize(desktop)
    await page.goto('/reports')
    await expect(
      page.getByRole('heading', { name: 'Reports', level: 1 }),
    ).toBeVisible()
    await waitForVisibleChartsToFit(page)
    await waitForMonthlyChartToFit(page, octoberTicks)
    await expect(page.getByText('2026-05').first()).toBeVisible()
    await expect(page.getByText('Not available').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: '62.5%' })).toBeVisible()
    await expect(
      page.getByText(
        'Largest category increases and decreases versus the previous period. Up to three increases and three decreases.',
      ),
    ).toBeVisible()
    await expect(page.getByText(/supplied by the API/i)).toHaveCount(0)

    const belowFold = chartRoot(page, 'category-changes')
    const belowFoldBox = await belowFold.boundingBox()
    const viewport = page.viewportSize()
    expect(belowFoldBox).toBeTruthy()
    expect(viewport).toBeTruthy()
    if (belowFoldBox && viewport) {
      expect(belowFoldBox.y).toBeGreaterThan(viewport.height - 80)
    }
    await openTooltipNearItem(page, 'monthly-trend')
    await expect(
      page.locator('[data-chart-tooltip="true"]').filter({ hasText: 'MMK' }),
    ).toBeVisible()
    await expect(
      page.locator('[data-chart-tooltip="true"]').filter({ hasText: '2026-' }),
    ).toBeVisible()
    await dismissTooltips(page)
    await openTooltipNearItem(page, 'category-changes')
    await assertNoHorizontalOverflow(page)
    await captureReviewScreenshot(page, 'reports-desktop-light.png')

    await resizeAndWait(page, mobile)
    await waitForMonthlyChartToFit(page, octoberTicks)
    await expect(page.getByText('2026-05').first()).toBeVisible()
    await captureReviewScreenshot(page, 'reports-mobile-light.png')

    await page.setViewportSize(desktop)
    await waitForVisibleChartsToFit(page)
    await page.getByLabel('As of date').fill('2026-09-30')
    await page.getByRole('button', { name: 'Apply date' }).click()
    await expect(page.getByText('As of 2026-09-30')).toBeVisible()
    await expect(page.getByText('As of 2026-10-19')).toHaveCount(0)
    await expect(page.getByText('100 MMK').first()).toBeVisible()
    await waitForMonthlyChartToFit(page, septemberTicks)
    await expect(page.getByText('2026-04').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: '62.5%' })).toHaveCount(0)
    await expect(
      page.getByRole('cell', { name: '100.0%', exact: true }),
    ).toBeVisible()

    await resizeAndWait(page, mobile)
    await waitForMonthlyChartToFit(page, septemberTicks)
    await expect(page.getByText('2026-04').first()).toBeVisible()

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('dashboard and reports stay readable in dark theme', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('expense_theme', 'dark')
    })
    await page.setViewportSize(desktop)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await waitForVisibleChartsToFit(page)
    await captureReviewScreenshot(page, 'dashboard-desktop-dark.png')

    await resizeAndWait(page, mobile)
    await captureReviewScreenshot(page, 'dashboard-mobile-dark.png')

    await page.setViewportSize(desktop)
    await page.goto('/reports')
    await waitForVisibleChartsToFit(page)
    await waitForMonthlyChartToFit(page, octoberTicks)
    await captureReviewScreenshot(page, 'reports-desktop-dark.png')

    await resizeAndWait(page, mobile)
    await waitForMonthlyChartToFit(page, octoberTicks)
    await expect(page.getByText('2026-05').first()).toBeVisible()
    await captureReviewScreenshot(page, 'reports-mobile-dark.png')
  })

  test('dashboard charts render in Myanmar locale', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('expense_lang', 'my')
    })
    await page.goto('/')
    await expect(
      page.getByRole('figure', { name: 'နေ့စဉ် အသုံးစရိတ်' }),
    ).toBeVisible()
    await waitForChartToFit(page, 'spending-pace')
  })

  test('many long category names stay inspectable at mobile width', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, {
      analytics: analyticsWithManyCategories(20),
    })
    await page.setViewportSize(mobile)
    await page.goto('/reports')
    await expect(chartSurface(page, 'category-share')).toBeVisible()
    await waitForChartToFit(page, 'category-share')
    await assertNoHorizontalOverflow(page)

    const scroller = page.locator(
      '[data-chart="category-share"] [data-chart-scroll="true"]',
    )
    await expect(scroller).toBeVisible()
    const canScroll = await scroller.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 8,
    )
    expect(canScroll).toBe(true)

    const bar = page
      .locator('[data-chart="category-share"] .recharts-rectangle')
      .first()
    const box = await bar.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(20)

    await bar.hover({ force: true })
    await expect(page.locator('[data-chart-tooltip="true"]').first()).toBeVisible()
    await expect(
      page.getByText('Household supplies and long category name 01').first(),
    ).toBeVisible()
  })
})
