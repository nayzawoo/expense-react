import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Pencil, PlusCircle, RotateCcw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  createBeneficiary,
  listBeneficiaries,
  updateBeneficiary,
  updateBeneficiaryStatus,
  type Beneficiary,
  type BeneficiaryStatus,
} from '@/api/beneficiaries'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import {
  BeneficiaryForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiaries/BeneficiaryForm'
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
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type FormMode = 'create' | 'edit'
type StatusFilter = 'ALL' | BeneficiaryStatus

function beneficiaryErrorKey(err: unknown): string {
  if (err instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(err)) {
    return 'beneficiaries.errors.generic'
  }
  if (err.status === 409) {
    return 'beneficiaries.errors.conflict'
  }
  if (err.status === 403) {
    return 'beneficiaries.errors.forbidden'
  }
  if (err.status === 404) {
    return 'beneficiaries.errors.notFound'
  }
  if (err.status === 400) {
    return 'beneficiaries.errors.invalid'
  }
  return 'beneficiaries.errors.generic'
}

export function BeneficiariesPage() {
  const { t } = useTranslation()
  const { household, user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [selected, setSelected] = useState<Beneficiary | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!household) {
      setBeneficiaries([])
      setLoading(false)
      setError(t('beneficiaries.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await listBeneficiaries(household.id, 'ALL')
      setBeneficiaries(rows)
    } catch (err) {
      setBeneficiaries(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else {
        setError(t('beneficiaries.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!beneficiaries) {
      return []
    }
    if (statusFilter === 'ALL') {
      return beneficiaries
    }
    return beneficiaries.filter((row) => row.status === statusFilter)
  }, [beneficiaries, statusFilter])

  function openCreate() {
    setFormMode('create')
    setSelected(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(beneficiary: Beneficiary) {
    setFormMode('edit')
    setSelected(beneficiary)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    if (submitting) {
      return
    }
    setFormOpen(false)
    setSelected(null)
    setFormError(null)
  }

  function handleFormOpenChange(
    open: boolean,
    details?: { cancel: () => void },
  ) {
    if (open) {
      setFormOpen(true)
      return
    }
    if (submitting) {
      details?.cancel()
      return
    }
    closeForm()
  }

  async function handleSubmit(values: BeneficiaryFormValues) {
    if (!household) {
      setFormError(t('beneficiaries.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (formMode === 'create') {
        await createBeneficiary(household.id, values)
        toast.success(t('common.toast.created'))
      } else if (selected) {
        await updateBeneficiary(household.id, selected.id, values)
        toast.success(t('common.toast.updated'))
      }
      setFormOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(beneficiaryErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(
    beneficiary: Beneficiary,
    status: BeneficiaryStatus,
  ) {
    if (!household) {
      setError(t('beneficiaries.loadError'))
      return
    }

    setStatusBusyId(beneficiary.id)
    setError(null)
    try {
      await updateBeneficiaryStatus(household.id, beneficiary.id, status)
      toast.success(
        t(
          status === 'ARCHIVED'
            ? 'common.toast.archived'
            : 'common.toast.reactivated',
        ),
      )
      await load()
    } catch (err) {
      setError(t(beneficiaryErrorKey(err)))
    } finally {
      setStatusBusyId(null)
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('beneficiaries.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('beneficiaries.subtitle')}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <PlusCircle data-icon="inline-start" />
            {t('beneficiaries.add')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <PageErrorAlert
          title={t('beneficiaries.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden />
              {t('beneficiaries.title')}
            </CardTitle>
            <CardDescription>
              {household
                ? `${household.name} · ${household.currency}`
                : t('beneficiaries.subtitle')}
            </CardDescription>
          </div>
          <div className="grid gap-2 sm:w-48">
            <Label htmlFor="beneficiary-status-filter">
              {t('beneficiaries.fields.status')}
            </Label>
            <select
              id="beneficiary-status-filter"
              className={selectClassName}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">{t('beneficiaries.filters.allStatuses')}</option>
              <option value="ACTIVE">
                {t('beneficiaries.statuses.ACTIVE')}
              </option>
              <option value="ARCHIVED">
                {t('beneficiaries.statuses.ARCHIVED')}
              </option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('beneficiaries.fields.name')}</TableHead>
                  <TableHead>{t('beneficiaries.fields.kind')}</TableHead>
                  <TableHead>{t('beneficiaries.fields.sortOrder')}</TableHead>
                  <TableHead>{t('beneficiaries.fields.status')}</TableHead>
                  {isAdmin ? (
                    <TableHead>{t('beneficiaries.fields.actions')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((beneficiary) => {
                  const busy = statusBusyId === beneficiary.id
                  const isActive = beneficiary.status === 'ACTIVE'
                  return (
                    <TableRow key={beneficiary.id}>
                      <TableCell className="font-medium">
                        {beneficiary.name}
                      </TableCell>
                      <TableCell>
                        {t(`beneficiaries.kinds.${beneficiary.kind}`, {
                          defaultValue: beneficiary.kind,
                        })}
                      </TableCell>
                      <TableCell>{beneficiary.sortOrder}</TableCell>
                      <TableCell>
                        <Badge
                          variant={isActive ? 'secondary' : 'outline'}
                        >
                          {t(`beneficiaries.statuses.${beneficiary.status}`, {
                            defaultValue: beneficiary.status,
                          })}
                        </Badge>
                      </TableCell>
                      {isAdmin ? (
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || submitting}
                              onClick={() => openEdit(beneficiary)}
                            >
                              <Pencil data-icon="inline-start" />
                              {t('beneficiaries.edit')}
                            </Button>
                            {isActive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || submitting}
                                onClick={() =>
                                  void handleStatusChange(
                                    beneficiary,
                                    'ARCHIVED',
                                  )
                                }
                              >
                                <Archive data-icon="inline-start" />
                                {busy
                                  ? t('beneficiaries.form.updatingStatus')
                                  : t('beneficiaries.archive')}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || submitting}
                                onClick={() =>
                                  void handleStatusChange(
                                    beneficiary,
                                    'ACTIVE',
                                  )
                                }
                              >
                                <RotateCcw data-icon="inline-start" />
                                {busy
                                  ? t('beneficiaries.form.updatingStatus')
                                  : t('beneficiaries.restore')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={Users}
              message={
                beneficiaries && beneficiaries.length > 0
                  ? t('beneficiaries.filters.none')
                  : t('beneficiaries.empty')
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        disablePointerDismissal={submitting}
        onOpenChange={handleFormOpenChange}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!submitting}
        >
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create'
                ? t('beneficiaries.form.createTitle')
                : t('beneficiaries.form.editTitle')}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? t('beneficiaries.form.createHint')
                : t('beneficiaries.form.editHint')}
            </DialogDescription>
          </DialogHeader>
          <BeneficiaryForm
            key={
              formMode === 'edit' && selected
                ? selected.id
                : `create-${String(formOpen)}`
            }
            mode={formMode}
            beneficiary={selected}
            submitting={submitting}
            error={formError}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
