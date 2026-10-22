import { useCallback, useEffect, useRef, useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { listAccounts } from '@/api/accounts'
import { listBeneficiaries, type Beneficiary } from '@/api/beneficiaries'
import { listCategories, type Category } from '@/api/categories'
import { createExpense } from '@/api/expenses'
import type { Account } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import {
  ExpenseForm,
  type ExpenseFormValues,
} from '@/components/expenses/ExpenseForm'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { expenseErrorKey } from '@/lib/expense-errors'

type CreateExpenseDialogProps = {
  onCreated: () => Promise<void> | void
}

function isActive(row: { status: string }): boolean {
  return row.status === 'ACTIVE'
}

export function CreateExpenseDialog({ onCreated }: CreateExpenseDialogProps) {
  const { t } = useTranslation()
  const { household } = useAuth()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const loadGeneration = useRef(0)
  const submitLock = useRef(false)

  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [refsLoading, setRefsLoading] = useState(false)
  const [refsError, setRefsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadRefs = useCallback(async () => {
    const requestId = ++loadGeneration.current
    const householdId = household?.id

    if (!householdId) {
      setAccounts([])
      setCategories([])
      setBeneficiaries([])
      setRefsLoading(false)
      setRefsError(t('expenses.loadError'))
      return
    }

    setRefsLoading(true)
    setRefsError(null)
    try {
      const [accountRows, categoryRows, beneficiaryRows] = await Promise.all([
        listAccounts(householdId),
        listCategories(householdId, 'ACTIVE'),
        listBeneficiaries(householdId, 'ACTIVE'),
      ])
      if (requestId !== loadGeneration.current) {
        return
      }
      setAccounts(accountRows.filter(isActive))
      setCategories(categoryRows.filter(isActive))
      setBeneficiaries(beneficiaryRows.filter(isActive))
    } catch (err) {
      if (requestId !== loadGeneration.current) {
        return
      }
      setAccounts([])
      setCategories([])
      setBeneficiaries([])
      setRefsError(t(expenseErrorKey(err)))
    } finally {
      if (requestId === loadGeneration.current) {
        setRefsLoading(false)
      }
    }
  }, [household, t])

  useEffect(() => {
    if (!open) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      void loadRefs()
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [open, loadRefs])

  function dismissDialog() {
    loadGeneration.current += 1
    submitLock.current = false
    setSubmitting(false)
    setAccounts([])
    setCategories([])
    setBeneficiaries([])
    setRefsLoading(false)
    setRefsError(null)
    setFormError(null)
    setOpen(false)
    queueMicrotask(() => {
      triggerRef.current?.focus()
    })
  }

  function closeDialog() {
    if (submitLock.current) {
      return
    }
    dismissDialog()
  }

  function openDialog() {
    setFormError(null)
    setRefsError(null)
    setRefsLoading(true)
    setOpen(true)
  }

  function handleOpenChange(
    nextOpen: boolean,
    details?: { cancel: () => void },
  ) {
    if (nextOpen) {
      openDialog()
      return
    }
    if (submitLock.current) {
      details?.cancel()
      return
    }
    dismissDialog()
  }

  async function handleSubmit(values: ExpenseFormValues) {
    if (!household || submitLock.current) {
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setFormError(null)
    try {
      await createExpense(household.id, {
        effectiveDate: values.effectiveDate,
        amount: values.amount,
        accountId: values.accountId,
        categoryId: values.categoryId,
        beneficiaryId: values.beneficiaryId,
        note: values.note || undefined,
      })
    } catch (err) {
      submitLock.current = false
      setSubmitting(false)
      setFormError(t(expenseErrorKey(err)))
      return
    }

    toast.success(t('common.toast.created'))
    dismissDialog()

    try {
      await onCreated()
    } catch {
      // Refresh failures belong to the dashboard, not this write.
    }
  }

  const canCreate =
    accounts.length > 0 && categories.length > 0 && beneficiaries.length > 0
  const emptyMessage =
    accounts.length === 0
      ? t('expenses.form.noAccounts')
      : categories.length === 0
        ? t('expenses.form.noCategories')
        : t('expenses.form.noBeneficiaries')

  return (
    <>
      <Button ref={triggerRef} type="button" onClick={openDialog}>
        <PlusCircle data-icon="inline-start" />
        {t('dashboard.quickAdd')}
      </Button>
      <Dialog
        open={open}
        disablePointerDismissal={submitting}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>{t('expenses.form.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('expenses.form.createHint')}
            </DialogDescription>
          </DialogHeader>
          {refsLoading ? (
            <PageLoading />
          ) : refsError ? (
            <PageErrorAlert
              title={t('expenses.form.createTitle')}
              message={refsError}
              onRetry={() => void loadRefs()}
            />
          ) : !canCreate ? (
            <PageEmptyState message={emptyMessage} />
          ) : household ? (
            <ExpenseForm
              key={`${household.id}-${accounts[0]?.id ?? ''}-${categories[0]?.id ?? ''}-${beneficiaries[0]?.id ?? ''}`}
              mode="create"
              accounts={accounts}
              categories={categories}
              beneficiaries={beneficiaries}
              currency={household.currency}
              timeZone={household.timezone}
              submitting={submitting}
              error={formError}
              onSubmit={handleSubmit}
              onCancel={closeDialog}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
