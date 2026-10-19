import { useEffect } from 'react'

import { reportQualifyingActivity } from '@/api/auth'
import { isApiError } from '@/api/errors'

const THROTTLE_MS = 60_000

const INTERACTION_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
] as const

export type QualifyingActivityController = {
  dispose: () => void
}

type ReportFn = () => Promise<unknown>

/**
 * Posts CSRF-protected qualifying activity on real user interaction.
 * Passive polling / idle tabs do not extend the Spring idle window.
 */
export function startQualifyingActivityReporting(
  target: EventTarget = window,
  report: ReportFn = reportQualifyingActivity,
): QualifyingActivityController {
  let lastSentAt: number | null = null
  let inFlight = false

  const maybeReport = () => {
    const now = Date.now()
    if (
      inFlight ||
      (lastSentAt !== null && now - lastSentAt < THROTTLE_MS)
    ) {
      return
    }
    inFlight = true
    lastSentAt = now
    void Promise.resolve(report())
      .catch((error: unknown) => {
        // 401 is handled by the api client unauthorized handler.
        if (!(isApiError(error) && error.status === 401)) {
          lastSentAt = now
        }
      })
      .finally(() => {
        inFlight = false
      })
  }

  for (const eventName of INTERACTION_EVENTS) {
    target.addEventListener(eventName, maybeReport, { passive: true })
  }

  return {
    dispose: () => {
      for (const eventName of INTERACTION_EVENTS) {
        target.removeEventListener(eventName, maybeReport)
      }
    },
  }
}

export function useQualifyingActivity(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }
    const controller = startQualifyingActivityReporting(window)
    return () => controller.dispose()
  }, [enabled])
}

export const QUALIFYING_ACTIVITY_THROTTLE_MS = THROTTLE_MS
