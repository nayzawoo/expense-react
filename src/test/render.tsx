import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'

import i18n from '@/i18n'

type Options = Omit<RenderOptions, 'wrapper'> & {
  route?: string
  routes?: string[]
  wrapper?: (props: { children: ReactNode }) => ReactElement
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', routes, wrapper: ExtraWrapper, ...options }: Options = {},
) {
  const initialEntries = routes ?? [route]

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </I18nextProvider>
    )
    return ExtraWrapper ? <ExtraWrapper>{tree}</ExtraWrapper> : tree
  }

  return render(ui, { wrapper: Wrapper, ...options })
}
