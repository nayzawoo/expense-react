import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

import i18n from '@/i18n'
import { resetAuthClientForTests } from '@/api/client'
import { resetIdempotencyForTests } from '@/lib/idempotency'

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserverStub

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 256,
    right: 400,
    width: 400,
    height: 256,
    toJSON() {
      return {}
    },
  }
}

afterEach(() => {
  cleanup()
  resetAuthClientForTests()
  resetIdempotencyForTests()
  void i18n.changeLanguage('en')
})

await i18n.changeLanguage('en')
