import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Wallet } from 'lucide-react'

import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { renderWithProviders } from '@/test/render'

describe('page state helpers', () => {
  it('renders an empty message with status role', () => {
    renderWithProviders(
      <PageEmptyState icon={Wallet} message="No accounts yet." />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('No accounts yet.')
  })

  it('renders loading with a screen-reader label', () => {
    renderWithProviders(<PageLoading rows={2} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders a load error with retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    renderWithProviders(
      <PageErrorAlert
        title="Accounts"
        message="Could not load accounts."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Could not load accounts.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
