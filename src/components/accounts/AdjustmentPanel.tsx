import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ADJUSTMENT_REASON_MAX,
  type Adjustment,
} from '@/api/adjustments'
import type { Account } from '@/api/types'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  normalizeAdjustmentReason,
  validateActualBalance,
} from '@/lib/adjustment-errors'
import { formatMoney, formatSignedDelta, subtractSignedMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type AdjustmentFormValues = {
  actualBalance: string
  reason: string
}

type AdjustmentPanelProps = {
  accountName: string
  snapshot: Account | null
  snapshotLoading: boolean
  snapshotError: string | null
  onRetrySnapshot: () => void
  submitting: boolean
  submitLocked?: boolean
  formError: string | null
  balanceChanged: boolean
  onRefreshBalance: () => void
  refreshing: boolean
  reloadError: string | null
  onRetryReload: () => void
  voidLocked?: boolean
  onSubmit: (values: AdjustmentFormValues) => Promise<void>
  onCancel: () => void
  history: Adjustment[] | null
  historyLoading: boolean
  historyError: string | null
  onRetryHistory: () => void
  selected: Adjustment | null
  selectedLoading: boolean
  selectedError: string | null
  onSelect: (row: Adjustment) => void
  voiding: boolean
  onVoid: (reason: string) => Promise<void>
}

function VoidFields({
  busy,
  voiding,
  onVoid,
}: {
  busy: boolean
  voiding: boolean
  onVoid: (reason: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [voidReason, setVoidReason] = useState('')
  const [voidLocalError, setVoidLocalError] = useState<string | null>(null)

  async function handleVoid() {
    if (busy) {
      return
    }
    const normalizedReason = normalizeAdjustmentReason(voidReason)
    if (!normalizedReason) {
      setVoidLocalError(t('accounts.adjust.voidReasonRequired'))
      return
    }
    setVoidLocalError(null)
    await onVoid(normalizedReason)
  }

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      {voidLocalError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('accounts.adjust.errorTitle')}</AlertTitle>
          <AlertDescription>{voidLocalError}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {t('accounts.adjust.voidHint')}
      </p>
      <Label htmlFor="adjustment-void-reason">
        {t('accounts.adjust.voidReason')}
      </Label>
      <Input
        id="adjustment-void-reason"
        value={voidReason}
        maxLength={ADJUSTMENT_REASON_MAX}
        disabled={busy}
        onChange={(event) => setVoidReason(event.target.value)}
      />
      <Button
        type="button"
        variant="destructive"
        disabled={busy}
        onClick={() => void handleVoid()}
      >
        {voiding ? t('accounts.adjust.voiding') : t('accounts.adjust.void')}
      </Button>
    </div>
  )
}

export function AdjustmentPanel({
  accountName,
  snapshot,
  snapshotLoading,
  snapshotError,
  onRetrySnapshot,
  submitting,
  submitLocked = false,
  formError,
  balanceChanged,
  onRefreshBalance,
  refreshing,
  reloadError,
  onRetryReload,
  voidLocked = false,
  onSubmit,
  onCancel,
  history,
  historyLoading,
  historyError,
  onRetryHistory,
  selected,
  selectedLoading,
  selectedError,
  onSelect,
  voiding,
  onVoid,
}: AdjustmentPanelProps) {
  const { t } = useTranslation()
  const [actualBalance, setActualBalance] = useState('')
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const busy = submitting || voiding || refreshing
  const selectionLocked = busy || voidLocked
  const currency = snapshot?.currency ?? 'MMK'
  const currentBalance = snapshot?.currentBalance ?? null
  const delta =
    currentBalance === null
      ? null
      : subtractSignedMoney(actualBalance, currentBalance)
  const canSubmit =
    !busy &&
    !snapshotLoading &&
    snapshot?.status === 'ACTIVE' &&
    !reloadError &&
    !submitLocked

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || !snapshot) {
      return
    }
    setLocalError(null)

    const balanceError = validateActualBalance(
      actualBalance,
      snapshot.currentBalance,
    )
    if (balanceError) {
      setLocalError(t(balanceError))
      return
    }
    const normalizedReason = normalizeAdjustmentReason(reason)
    if (!normalizedReason) {
      setLocalError(t('accounts.adjust.reasonRequired'))
      return
    }

    await onSubmit({
      actualBalance: actualBalance.trim(),
      reason: normalizedReason,
    })
  }

  const displayError = localError ?? formError

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={busy}
      >
        {displayError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('accounts.adjust.errorTitle')}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{displayError}</span>
              {balanceChanged && !localError ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onRefreshBalance()}
                >
                  {refreshing
                    ? t('accounts.adjust.refreshing')
                    : t('accounts.adjust.refreshBalance')}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {reloadError ? (
          <PageErrorAlert
            title={t('accounts.adjust.reloadTitle')}
            message={reloadError}
            onRetry={onRetryReload}
          />
        ) : null}

        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('accounts.adjust.account')}
          </p>
          <p className="font-medium">{snapshot?.name ?? accountName}</p>
        </div>

        {snapshotError ? (
          <PageErrorAlert
            title={t('accounts.adjust.currentBalance')}
            message={snapshotError}
            onRetry={onRetrySnapshot}
          />
        ) : snapshotLoading && !snapshot ? (
          <PageLoading rows={2} />
        ) : snapshot ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('accounts.adjust.currentBalance')}
            </p>
            <p
              className={cn(
                'text-lg font-semibold tabular-nums',
                snapshot.negativeBalanceWarning && 'text-destructive',
              )}
            >
              {formatMoney(snapshot.currentBalance, snapshot.currency)}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="adjustment-actual-balance">
            {t('accounts.adjust.actualBalance', { currency })}
          </Label>
          <Input
            id="adjustment-actual-balance"
            inputMode="numeric"
            autoComplete="off"
            value={actualBalance}
            disabled={busy || snapshotLoading || !snapshot}
            onChange={(event) => setActualBalance(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('accounts.adjust.actualBalanceHint')}
          </p>
        </div>

        <div
          className="rounded-lg border border-border px-3 py-2"
          aria-live="polite"
        >
          <p className="text-xs text-muted-foreground">
            {t('accounts.adjust.preview')}
          </p>
          {delta === null ? (
            <p className="text-sm text-muted-foreground">
              {t('accounts.adjust.previewPending')}
            </p>
          ) : (
            <p
              className={cn(
                'text-lg font-semibold tabular-nums',
                delta.startsWith('-') && 'text-destructive',
              )}
            >
              {formatSignedDelta(delta, currency)}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="adjustment-reason">
            {t('accounts.adjust.reason')}
          </Label>
          <Input
            id="adjustment-reason"
            value={reason}
            maxLength={ADJUSTMENT_REASON_MAX}
            autoComplete="off"
            disabled={busy || snapshotLoading || !snapshot}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSubmit}>
            {submitting
              ? t('accounts.adjust.submitting')
              : t('accounts.adjust.submit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </form>

      <section className="grid gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium">{t('accounts.adjust.historyTitle')}</h3>
        {historyError ? (
          <PageErrorAlert
            title={t('accounts.adjust.historyTitle')}
            message={historyError}
            onRetry={onRetryHistory}
          />
        ) : null}
        {historyLoading ? (
          <PageLoading rows={2} />
        ) : history && history.length > 0 ? (
          <ul className="grid gap-2">
            {history.map((row) => {
              const isSelected = selected?.id === row.id
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-lg border border-border px-3 py-2 text-left transition-colors',
                      'hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                      isSelected && 'bg-muted',
                    )}
                    disabled={selectionLocked}
                    onClick={() => onSelect(row)}
                    aria-pressed={isSelected}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium">
                        {row.effectiveDate}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          row.amount.startsWith('-') && 'text-destructive',
                        )}
                      >
                        {formatSignedDelta(row.amount, row.currency)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{row.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('accounts.adjust.before')}{' '}
                      {formatMoney(row.balanceBefore, row.currency)}
                      {' → '}
                      {t('accounts.adjust.actual')}{' '}
                      {formatMoney(row.observedBalance, row.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.createdBy.displayName}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <PageEmptyState message={t('accounts.adjust.historyEmpty')} />
        )}

        {selectedLoading ? <PageLoading rows={2} /> : null}
        {selectedError ? (
          <PageErrorAlert
            title={t('accounts.adjust.detailTitle')}
            message={selectedError}
          />
        ) : null}

        {selected && !selectedLoading ? (
          <div className="grid gap-3 rounded-lg border border-border px-3 py-3">
            <h4 className="text-sm font-medium">
              {t('accounts.adjust.detailTitle')}
            </h4>
            <dl className="grid gap-2 text-sm">
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.reason')}
                </dt>
                <dd>{selected.reason}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.preview')}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatSignedDelta(selected.amount, selected.currency)}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.before')}
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(selected.balanceBefore, selected.currency)}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.actual')}
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(selected.observedBalance, selected.currency)}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.date')}
                </dt>
                <dd>{selected.effectiveDate}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-muted-foreground">
                  {t('accounts.adjust.actor')}
                </dt>
                <dd>{selected.createdBy.displayName}</dd>
              </div>
            </dl>

            {selected.capabilities.canVoid && !voidLocked ? (
              <VoidFields
                key={selected.id}
                busy={selectionLocked}
                voiding={voiding}
                onVoid={onVoid}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
