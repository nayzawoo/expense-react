import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PlusCircle, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  createAccount,
  getAccount,
  listAccounts,
  type Account,
  type AccountStatus,
  type CreateAccountInput,
} from '@/api/accounts'
import {
  getAdjustment,
  listAdjustments,
  reconcileAccount,
  voidAdjustment,
  type Adjustment,
} from '@/api/adjustments'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import {
  AccountForm,
  type AccountFormValues,
} from '@/components/accounts/AccountForm'
import {
  AdjustmentPanel,
  type AdjustmentFormValues,
} from '@/components/accounts/AdjustmentPanel'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  adjustmentErrorKey,
  isBalanceChangedError,
} from '@/lib/adjustment-errors'
import { idempotencyClientErrorKey } from '@/lib/idempotency'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type StatusFilter = 'ALL' | AccountStatus
type FormMode = 'create' | 'adjust'

function accountErrorKey(err: unknown): string {
  const recoveryKey = idempotencyClientErrorKey(err)
  if (recoveryKey) {
    return recoveryKey
  }
  if (err instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(err)) {
    return 'accounts.errors.generic'
  }

  const detail = (err.code ?? err.message ?? '').trim()
  if (detail === 'FUTURE_DATE') {
    return 'accounts.errors.futureDate'
  }
  if (detail === 'IDEMPOTENCY_KEY_REUSED') {
    return 'accounts.errors.idempotency'
  }

  if (err.status === 403) {
    return 'accounts.errors.forbidden'
  }
  if (err.status === 409) {
    return 'accounts.errors.conflict'
  }
  if (err.status === 404) {
    return 'accounts.errors.notFound'
  }
  if (err.status === 400 || err.status === 422) {
    return 'accounts.errors.invalid'
  }
  return 'accounts.errors.generic'
}

function loadFailureMessage(
  err: unknown,
  fallbackKey: string,
  translate: (key: string) => string,
): string {
  if (err instanceof TypeError) {
    return translate('common.offlineOrApi')
  }
  return translate(fallbackKey)
}

export function AccountsPage() {
  const { t } = useTranslation()
  const { household, user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  )
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [snapshot, setSnapshot] = useState<Account | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [balanceChanged, setBalanceChanged] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadError, setReloadError] = useState<string | null>(null)
  const [formSession, setFormSession] = useState(0)

  const [history, setHistory] = useState<Adjustment[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedAdjustment, setSelectedAdjustment] =
    useState<Adjustment | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [pendingToast, setPendingToast] = useState<string | null>(null)

  const adjustRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const selectedAccountIdRef = useRef<string | null>(null)
  const reloadInFlightRef = useRef(false)
  const mutationBusy = submitting || voiding || refreshing
  const voidLocked = Boolean(reloadError || pendingToast)

  function isFormFrozen() {
    return mutationBusy || reloadInFlightRef.current
  }

  function invalidateDetailSelection() {
    detailRequestRef.current += 1
    setSelectedAdjustment(null)
    setSelectedError(null)
    setSelectedLoading(false)
  }

  const load = useCallback(async () => {
    if (!household) {
      setAccounts([])
      setLoading(false)
      setError(t('accounts.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Spring list has no status query — filter client-side.
      const rows = await listAccounts(household.id)
      setAccounts(rows)
    } catch (err) {
      setAccounts(null)
      setError(loadFailureMessage(err, 'accounts.loadError', t))
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const visibleAccounts = useMemo(() => {
    if (!accounts) {
      return null
    }
    if (statusFilter === 'ALL') {
      return accounts
    }
    return accounts.filter((row) => row.status === statusFilter)
  }, [accounts, statusFilter])

  const nextSortOrder = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return 1
    }
    return Math.max(...accounts.map((row) => row.sortOrder)) + 1
  }, [accounts])

  const loadSnapshot = useCallback(
    async (accountId: string, requestId: number) => {
      if (!household) {
        setSnapshotError(t('accounts.loadError'))
        setSnapshotLoading(false)
        return
      }
      setSnapshotLoading(true)
      setSnapshotError(null)
      try {
        const fresh = await getAccount(household.id, accountId)
        if (requestId !== adjustRequestRef.current) {
          return
        }
        setSnapshot(fresh)
      } catch (err) {
        if (requestId !== adjustRequestRef.current) {
          return
        }
        setSnapshotError(loadFailureMessage(err, 'accounts.loadError', t))
      } finally {
        if (requestId === adjustRequestRef.current) {
          setSnapshotLoading(false)
        }
      }
    },
    [household, t],
  )

  const loadHistory = useCallback(
    async (accountId: string, requestId: number) => {
      if (!household || !isAdmin) {
        return
      }
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const rows = await listAdjustments(household.id)
        if (requestId !== adjustRequestRef.current) {
          return
        }
        setHistory(rows.filter((row) => row.account.id === accountId))
      } catch (err) {
        if (requestId !== adjustRequestRef.current) {
          return
        }
        setHistory(null)
        setHistoryError(
          loadFailureMessage(err, 'accounts.adjust.historyLoadError', t),
        )
      } finally {
        if (requestId === adjustRequestRef.current) {
          setHistoryLoading(false)
        }
      }
    },
    [household, isAdmin, t],
  )

  async function reloadAfterMutation(accountId: string): Promise<boolean> {
    if (!household) {
      setReloadError(t('accounts.loadError'))
      return false
    }
    if (reloadInFlightRef.current) {
      return false
    }
    reloadInFlightRef.current = true
    const requestId = ++adjustRequestRef.current
    invalidateDetailSelection()
    setRefreshing(true)
    setReloadError(null)
    try {
      const [rows, fresh, adjustmentRows] = await Promise.all([
        listAccounts(household.id),
        getAccount(household.id, accountId),
        listAdjustments(household.id),
      ])
      if (
        requestId !== adjustRequestRef.current ||
        selectedAccountIdRef.current !== accountId
      ) {
        return false
      }
      setAccounts(rows)
      setSnapshot(fresh)
      setSnapshotError(null)
      setHistory(adjustmentRows.filter((row) => row.account.id === accountId))
      setHistoryError(null)
      invalidateDetailSelection()
      return true
    } catch (err) {
      if (
        requestId !== adjustRequestRef.current ||
        selectedAccountIdRef.current !== accountId
      ) {
        return false
      }
      setReloadError(
        loadFailureMessage(err, 'accounts.adjust.reloadError', t),
      )
      return false
    } finally {
      reloadInFlightRef.current = false
      if (requestId === adjustRequestRef.current) {
        setRefreshing(false)
      }
    }
  }

  function resetAdjustState() {
    selectedAccountIdRef.current = null
    setSelectedAccountId(null)
    setSelectedAccountName('')
    setSnapshot(null)
    setSnapshotError(null)
    setSnapshotLoading(false)
    setBalanceChanged(false)
    setRefreshing(false)
    setReloadError(null)
    setHistory(null)
    setHistoryError(null)
    setHistoryLoading(false)
    invalidateDetailSelection()
    setFormError(null)
    setPendingToast(null)
  }

  function openCreate() {
    if (isFormFrozen()) {
      return
    }
    adjustRequestRef.current += 1
    resetAdjustState()
    setFormMode('create')
    setFormError(null)
    setFormOpen(true)
  }

  function openAdjust(account: Account) {
    if (!isAdmin || account.status !== 'ACTIVE' || isFormFrozen()) {
      return
    }
    const requestId = ++adjustRequestRef.current
    selectedAccountIdRef.current = account.id
    setFormMode('adjust')
    setSelectedAccountId(account.id)
    setSelectedAccountName(account.name)
    setSnapshot(null)
    setSnapshotError(null)
    setSnapshotLoading(false)
    setBalanceChanged(false)
    setRefreshing(false)
    setReloadError(null)
    setFormError(null)
    setPendingToast(null)
    setHistory(null)
    setHistoryError(null)
    setHistoryLoading(false)
    invalidateDetailSelection()
    setFormSession((current) => current + 1)
    setFormOpen(true)
    void loadSnapshot(account.id, requestId)
    void loadHistory(account.id, requestId)
  }

  function closeForm() {
    if (isFormFrozen()) {
      return
    }
    adjustRequestRef.current += 1
    setFormOpen(false)
    resetAdjustState()
  }

  function handleFormOpenChange(
    open: boolean,
    details?: { cancel: () => void },
  ) {
    if (open) {
      setFormOpen(true)
      return
    }
    if (isFormFrozen()) {
      details?.cancel()
      return
    }
    closeForm()
  }

  async function handleSubmit(values: AccountFormValues | CreateAccountInput) {
    if (!household) {
      setFormError(t('accounts.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createAccount(household.id, values as CreateAccountInput)
      toast.success(t('common.toast.created'))
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormError(t(accountErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReconcile(values: AdjustmentFormValues) {
    if (!household || !snapshot || isFormFrozen() || voidLocked) {
      return
    }
    if (snapshot.status !== 'ACTIVE') {
      setFormError(t('accounts.adjust.errors.accountNotActive'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    setBalanceChanged(false)
    setReloadError(null)
    try {
      await reconcileAccount(household.id, snapshot.id, {
        actualBalance: values.actualBalance,
        expectedBalanceVersion: snapshot.balanceVersion,
        reason: values.reason,
      })
      setPendingToast('common.toast.created')
      const refreshed = await reloadAfterMutation(snapshot.id)
      if (!refreshed) {
        return
      }
      toast.success(t('common.toast.created'))
      setPendingToast(null)
      setFormSession((current) => current + 1)
    } catch (err) {
      setFormError(t(adjustmentErrorKey(err)))
      setBalanceChanged(isBalanceChangedError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetryReload() {
    const accountId = selectedAccountIdRef.current
    if (!accountId || isFormFrozen()) {
      return
    }
    const refreshed = await reloadAfterMutation(accountId)
    if (!refreshed || !pendingToast) {
      return
    }
    toast.success(t(pendingToast))
    setPendingToast(null)
    setFormSession((current) => current + 1)
  }

  async function handleRefreshBalance() {
    const accountId = selectedAccountIdRef.current
    if (!household || !accountId || isFormFrozen()) {
      return
    }
    const requestId = ++adjustRequestRef.current
    setRefreshing(true)
    setReloadError(null)
    try {
      const fresh = await getAccount(household.id, accountId)
      if (
        requestId !== adjustRequestRef.current ||
        selectedAccountIdRef.current !== accountId
      ) {
        return
      }
      setSnapshot(fresh)
      setSnapshotError(null)
      setBalanceChanged(false)
      setFormError(null)
    } catch (err) {
      if (
        requestId !== adjustRequestRef.current ||
        selectedAccountIdRef.current !== accountId
      ) {
        return
      }
      setReloadError(loadFailureMessage(err, 'accounts.adjust.reloadError', t))
    } finally {
      if (requestId === adjustRequestRef.current) {
        setRefreshing(false)
      }
    }
  }

  async function handleSelectAdjustment(row: Adjustment) {
    if (!household || isFormFrozen() || voidLocked) {
      return
    }
    const accountId = selectedAccountIdRef.current
    if (!accountId || row.account.id !== accountId) {
      return
    }
    const requestId = ++detailRequestRef.current
    setSelectedAdjustment(row)
    setSelectedError(null)
    setSelectedLoading(true)
    try {
      const detail = await getAdjustment(household.id, row.id)
      if (requestId !== detailRequestRef.current) {
        return
      }
      if (
        selectedAccountIdRef.current !== accountId ||
        detail.account.id !== accountId
      ) {
        setSelectedAdjustment(null)
        setSelectedLoading(false)
        return
      }
      setSelectedAdjustment(detail)
    } catch (err) {
      if (requestId !== detailRequestRef.current) {
        return
      }
      setSelectedError(
        loadFailureMessage(err, 'accounts.adjust.detailLoadError', t),
      )
    } finally {
      if (requestId === detailRequestRef.current) {
        setSelectedLoading(false)
      }
    }
  }

  async function handleVoid(reason: string) {
    if (
      !household ||
      !selectedAdjustment ||
      !selectedAccountId ||
      isFormFrozen() ||
      voidLocked
    ) {
      return
    }
    if (selectedAdjustment.account.id !== selectedAccountId) {
      return
    }
    const accountId = selectedAccountId
    const adjustmentId = selectedAdjustment.id
    const adjustmentVersion = selectedAdjustment.version
    setVoiding(true)
    setFormError(null)
    setReloadError(null)
    try {
      await voidAdjustment(household.id, adjustmentId, adjustmentVersion, {
        reason,
      })
      setPendingToast('common.toast.voided')
      invalidateDetailSelection()
      const refreshed = await reloadAfterMutation(accountId)
      if (!refreshed) {
        return
      }
      toast.success(t('common.toast.voided'))
      setPendingToast(null)
    } catch (err) {
      setFormError(t(adjustmentErrorKey(err)))
    } finally {
      setVoiding(false)
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('accounts.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('accounts.subtitle')}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate} disabled={mutationBusy}>
            <PlusCircle data-icon="inline-start" />
            {t('accounts.add')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <PageErrorAlert
          title={t('accounts.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" aria-hidden />
                {t('accounts.title')}
              </CardTitle>
              <CardDescription>
                {household
                  ? `${household.name} · ${household.currency}`
                  : t('accounts.subtitle')}
              </CardDescription>
            </div>
            <div className="grid min-w-40 gap-1.5">
              <Label htmlFor="account-status-filter">
                {t('accounts.filterStatus')}
              </Label>
              <select
                id="account-status-filter"
                className={selectClassName}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="ALL">{t('accounts.filters.all')}</option>
                <option value="ACTIVE">{t('accounts.statuses.ACTIVE')}</option>
                <option value="ARCHIVED">
                  {t('accounts.statuses.ARCHIVED')}
                </option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : visibleAccounts && visibleAccounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('accounts.fields.name')}</TableHead>
                  <TableHead>{t('accounts.fields.type')}</TableHead>
                  <TableHead>{t('accounts.fields.owner')}</TableHead>
                  <TableHead>{t('accounts.fields.balance')}</TableHead>
                  <TableHead>{t('accounts.fields.status')}</TableHead>
                  {isAdmin ? (
                    <TableHead>{t('accounts.fields.actions')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('accounts.asOf', { date: account.balanceAsOf })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t(`accounts.types.${account.type}`, {
                        defaultValue: account.type,
                      })}
                    </TableCell>
                    <TableCell>{account.ownerLabel}</TableCell>
                    <TableCell
                      className={
                        account.negativeBalanceWarning
                          ? 'font-medium text-destructive'
                          : 'font-medium'
                      }
                    >
                      {formatMoney(account.currentBalance, account.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          account.status === 'ACTIVE' ? 'secondary' : 'outline'
                        }
                      >
                        {t(`accounts.statuses.${account.status}`, {
                          defaultValue: account.status,
                        })}
                      </Badge>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        {account.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutationBusy}
                            onClick={() => openAdjust(account)}
                          >
                            {t('accounts.adjust.action')}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState icon={Wallet} message={t('accounts.empty')} />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        disablePointerDismissal={mutationBusy}
        onOpenChange={handleFormOpenChange}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!mutationBusy}
        >
          {formMode === 'create' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('accounts.form.createTitle')}</DialogTitle>
                <DialogDescription>
                  {t('accounts.form.createHint')}
                </DialogDescription>
              </DialogHeader>
              {household ? (
                <AccountForm
                  key={`create-${formOpen}`}
                  defaultSortOrder={nextSortOrder}
                  currency={household.currency}
                  timeZone={household.timezone}
                  submitting={submitting}
                  error={formError}
                  onSubmit={handleSubmit}
                  onCancel={closeForm}
                />
              ) : null}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t('accounts.adjust.title')}</DialogTitle>
                <DialogDescription>
                  {t('accounts.adjust.hint')}
                </DialogDescription>
              </DialogHeader>
              <AdjustmentPanel
                key={`adjust-${formSession}`}
                accountName={selectedAccountName}
                snapshot={snapshot}
                snapshotLoading={snapshotLoading}
                snapshotError={snapshotError}
                onRetrySnapshot={() => {
                  if (!selectedAccountId || isFormFrozen()) {
                    return
                  }
                  const requestId = ++adjustRequestRef.current
                  invalidateDetailSelection()
                  void loadSnapshot(selectedAccountId, requestId)
                }}
                submitting={submitting}
                formError={formError}
                balanceChanged={balanceChanged}
                onRefreshBalance={() => void handleRefreshBalance()}
                refreshing={refreshing}
                reloadError={reloadError}
                onRetryReload={() => void handleRetryReload()}
                submitLocked={Boolean(pendingToast)}
                voidLocked={voidLocked}
                onSubmit={handleReconcile}
                onCancel={closeForm}
                history={history}
                historyLoading={historyLoading}
                historyError={historyError}
                onRetryHistory={() => {
                  if (!selectedAccountId || isFormFrozen()) {
                    return
                  }
                  void loadHistory(
                    selectedAccountId,
                    adjustRequestRef.current,
                  )
                }}
                selected={selectedAdjustment}
                selectedLoading={selectedLoading}
                selectedError={selectedError}
                onSelect={(row) => void handleSelectAdjustment(row)}
                voiding={voiding}
                onVoid={handleVoid}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
