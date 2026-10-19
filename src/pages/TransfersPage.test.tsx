import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '@/auth/auth-context'
import type { Transfer } from '@/api/transfers'
import { TransfersPage } from '@/pages/TransfersPage'
import {
  sampleAccounts,
  sampleHousehold,
  sampleUser,
} from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const useAuthMock = vi.fn()
const listTransfersMock = vi.fn()
const listAccountsMock = vi.fn()
const createTransferMock = vi.fn()
const voidTransferMock = vi.fn()

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/api/transfers', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/transfers')>('@/api/transfers')
  return {
    ...actual,
    listTransfers: (...args: unknown[]) => listTransfersMock(...args),
    createTransfer: (...args: unknown[]) => createTransferMock(...args),
    voidTransfer: (...args: unknown[]) => voidTransferMock(...args),
  }
})

vi.mock('@/api/accounts', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/accounts')>('@/api/accounts')
  return {
    ...actual,
    listAccounts: (...args: unknown[]) => listAccountsMock(...args),
  }
})

const sampleTransfers: Transfer[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'TRANSFER',
    state: 'POSTED',
    effectiveDate: '2026-10-12',
    amount: '100',
    currency: 'MMK',
    note: 'Move to wallet',
    sourceAccount: {
      id: sampleAccounts[0]!.id,
      name: sampleAccounts[0]!.name,
    },
    destinationAccount: {
      id: sampleAccounts[1]!.id,
      name: sampleAccounts[1]!.name,
    },
    createdBy: {
      userId: sampleUser.id,
      displayName: sampleUser.displayName,
    },
    recordedAt: '2026-10-12T03:00:00Z',
    version: 0,
    revisionNo: 1,
    capabilities: { canVoid: true },
  },
]

function authValue(partial: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: sampleUser,
    household: sampleHousehold,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshSession: vi.fn(),
    clearError: vi.fn(),
    ...partial,
  }
}

describe('TransfersPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    listTransfersMock.mockReset()
    listAccountsMock.mockReset()
    createTransferMock.mockReset()
    voidTransferMock.mockReset()
  })

  it('renders posted transfers from the API', async () => {
    useAuthMock.mockReturnValue(authValue())
    listTransfersMock.mockResolvedValue(sampleTransfers)
    listAccountsMock.mockResolvedValue(sampleAccounts)

    renderWithProviders(<TransfersPage />)

    expect(await screen.findByText('Move to wallet')).toBeInTheDocument()
    expect(screen.getAllByText('Cash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0)
    expect(listTransfersMock).toHaveBeenCalledWith(sampleHousehold.id)
    expect(listAccountsMock).toHaveBeenCalledWith(sampleHousehold.id)
  })

  it('lets members create a transfer between active accounts', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listTransfersMock
      .mockResolvedValueOnce(sampleTransfers)
      .mockResolvedValueOnce([
        ...sampleTransfers,
        {
          ...sampleTransfers[0]!,
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          amount: '250',
          note: 'Top up',
          effectiveDate: '2026-10-19',
        },
      ])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    createTransferMock.mockResolvedValue({
      ...sampleTransfers[0]!,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      amount: '250',
      note: 'Top up',
      effectiveDate: '2026-10-19',
    })

    renderWithProviders(<TransfersPage />)

    await screen.findByText('Move to wallet')
    await user.click(screen.getByRole('button', { name: 'Add transfer' }))

    const amount = await screen.findByLabelText(/Amount/)
    await user.clear(amount)
    await user.type(amount, '250')
    const note = screen.getByLabelText('Note')
    await user.clear(note)
    await user.type(note, 'Top up')
    await user.click(screen.getByRole('button', { name: 'Save transfer' }))

    await waitFor(() => {
      expect(createTransferMock).toHaveBeenCalledWith(sampleHousehold.id, {
        effectiveDate: expect.any(String),
        amount: '250',
        sourceAccountId: sampleAccounts[0]!.id,
        destinationAccountId: sampleAccounts[1]!.id,
        note: 'Top up',
      })
    })
    expect(await screen.findByText('Top up')).toBeInTheDocument()
  })

  it('voids a transfer when the creator can void', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(authValue())
    listTransfersMock
      .mockResolvedValueOnce(sampleTransfers)
      .mockResolvedValueOnce([])
    listAccountsMock.mockResolvedValue(sampleAccounts)
    voidTransferMock.mockResolvedValue({
      ...sampleTransfers[0]!,
      state: 'VOIDED',
      capabilities: { canVoid: false },
    })

    renderWithProviders(<TransfersPage />)

    await screen.findByText('Move to wallet')
    await user.click(screen.getByRole('button', { name: 'View' }))

    const reason = await screen.findByLabelText('Void reason')
    await user.type(reason, 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void transfer' }))

    await waitFor(() => {
      expect(voidTransferMock).toHaveBeenCalledWith(
        sampleHousehold.id,
        sampleTransfers[0]!.id,
        0,
        { reason: 'Entered twice' },
      )
    })
    expect(
      await screen.findByText('No posted transfers yet.'),
    ).toBeInTheDocument()
  })
})
