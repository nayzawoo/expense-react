import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Beneficiary } from '@/api/beneficiaries'
import type { Income } from '@/api/incomes'
import { IncomeForm } from '@/components/incomes/IncomeForm'
import { householdToday } from '@/lib/household-date'
import { MAX_MONEY_ABS } from '@/lib/money'
import { sampleAccounts, sampleHousehold, sampleUser } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const activeAccounts = sampleAccounts.filter((row) => row.status === 'ACTIVE')

const beneficiaries: Beneficiary[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Family Pool',
    kind: 'HOUSEHOLD',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  },
]

const sampleIncome: Income = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  kind: 'INCOME',
  state: 'POSTED',
  effectiveDate: '2026-10-15',
  amount: '400',
  currency: 'MMK',
  note: 'Salary',
  account: {
    id: sampleAccounts[0]!.id,
    name: sampleAccounts[0]!.name,
    kind: null,
  },
  beneficiary: {
    id: beneficiaries[0]!.id,
    name: beneficiaries[0]!.name,
    kind: 'HOUSEHOLD',
  },
  createdBy: {
    userId: sampleUser.id,
    displayName: sampleUser.displayName,
  },
  recordedAt: '2026-10-15T02:00:00Z',
  version: 0,
  revisionNo: 1,
  capabilities: { canVoid: true },
}

function renderCreate(
  overrides: Partial<Parameters<typeof IncomeForm>[0]> = {},
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  renderWithProviders(
    <IncomeForm
      mode="create"
      accounts={activeAccounts}
      beneficiaries={beneficiaries}
      currency="MMK"
      timeZone={sampleHousehold.timezone}
      submitting={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSubmit, onCancel }
}

describe('IncomeForm', () => {
  it('defaults the date to household-local today', () => {
    renderCreate()
    expect(screen.getByLabelText('Date')).toHaveValue(
      householdToday(sampleHousehold.timezone),
    )
  })

  it('rejects zero, fractional, and out-of-range amounts', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate()
    const amount = screen.getByLabelText(/Amount/)

    await user.type(amount, '0')
    await user.click(screen.getByRole('button', { name: 'Save income' }))
    expect(
      await screen.findByText(
        'Amount must be a whole positive number with no decimals.',
      ),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(amount)
    await user.type(amount, '12.5')
    await user.click(screen.getByRole('button', { name: 'Save income' }))
    expect(
      screen.getByText(
        'Amount must be a whole positive number with no decimals.',
      ),
    ).toBeInTheDocument()

    await user.clear(amount)
    await user.type(amount, (MAX_MONEY_ABS + 1n).toString())
    await user.click(screen.getByRole('button', { name: 'Save income' }))
    expect(
      screen.getByText(
        'Amount must be a whole positive number with no decimals.',
      ),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts the inclusive money bound and submits trimmed values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate()

    await user.type(screen.getByLabelText(/Amount/), MAX_MONEY_ABS.toString())
    await user.type(screen.getByLabelText('Note'), '  Salary  ')
    await user.click(screen.getByRole('button', { name: 'Save income' }))

    expect(onSubmit).toHaveBeenCalledWith({
      effectiveDate: householdToday(sampleHousehold.timezone),
      amount: MAX_MONEY_ABS.toString(),
      accountId: sampleAccounts[0]!.id,
      beneficiaryId: beneficiaries[0]!.id,
      note: 'Salary',
    })
  })

  it('requires an active account and beneficiary', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderCreate({
      accounts: [],
      beneficiaries: [],
    })

    expect(screen.getByLabelText('Account')).toHaveTextContent(
      'No active accounts',
    )
    expect(screen.getByLabelText('Beneficiary')).toHaveTextContent(
      'No active beneficiaries',
    )
    expect(screen.getByRole('button', { name: 'Save income' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save income' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks cancel and hides close while a write is in progress', () => {
    renderCreate({ submitting: true })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows void controls only when canVoid is true', async () => {
    const user = userEvent.setup()
    const onVoid = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <IncomeForm
        mode="detail"
        income={{ ...sampleIncome, capabilities: { canVoid: false } }}
        accounts={activeAccounts}
        beneficiaries={beneficiaries}
        currency="MMK"
        timeZone={sampleHousehold.timezone}
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onVoid={onVoid}
      />,
    )

    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Void income' }),
    ).not.toBeInTheDocument()

    renderWithProviders(
      <IncomeForm
        mode="detail"
        income={sampleIncome}
        accounts={activeAccounts}
        beneficiaries={beneficiaries}
        currency="MMK"
        timeZone={sampleHousehold.timezone}
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onVoid={onVoid}
      />,
    )

    await user.type(screen.getByLabelText('Void reason'), 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void income' }))
    expect(onVoid).toHaveBeenCalledWith('Entered twice')
  })
})
