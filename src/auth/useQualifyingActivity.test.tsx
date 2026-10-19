import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  QUALIFYING_ACTIVITY_THROTTLE_MS,
  startQualifyingActivityReporting,
} from '@/auth/useQualifyingActivity'

describe('startQualifyingActivityReporting', () => {
  let now = 0

  beforeEach(() => {
    now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports on user interaction and throttles repeats', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    const target = new EventTarget()
    const controller = startQualifyingActivityReporting(target, report)

    target.dispatchEvent(new Event('keydown'))
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(1)

    target.dispatchEvent(new Event('keydown'))
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(1)

    now += QUALIFYING_ACTIVITY_THROTTLE_MS + 1
    target.dispatchEvent(new Event('keydown'))
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(2)

    controller.dispose()
    now += QUALIFYING_ACTIVITY_THROTTLE_MS + 1
    target.dispatchEvent(new Event('keydown'))
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(2)
  })
})
