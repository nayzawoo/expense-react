import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyRound,
  Pencil,
  PlusCircle,
  UserRound,
  UserX,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { isApiError } from '@/api/errors'
import {
  assignTemporaryPassword,
  createHouseholdUser,
  listHouseholdUsers,
  updateHouseholdUser,
  type CreateHouseholdUserInput,
  type HouseholdUser,
  type UpdateHouseholdUserInput,
  type UserStatus,
} from '@/api/users'
import { useAuth } from '@/auth/useAuth'
import {
  MemberForm,
} from '@/components/members/MemberForm'
import { TemporaryPasswordForm } from '@/components/members/TemporaryPasswordForm'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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

type SheetMode = 'create' | 'edit' | 'resetPassword'
type StatusFilter = 'ALL' | UserStatus

function memberErrorKey(err: unknown): string {
  if (err instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (!isApiError(err)) {
    return 'members.errors.generic'
  }
  if (err.status === 409) {
    return 'members.errors.conflict'
  }
  if (err.status === 403) {
    return 'members.errors.forbidden'
  }
  if (err.status === 404) {
    return 'members.errors.notFound'
  }
  if (err.status === 400) {
    return 'members.errors.invalid'
  }
  return 'members.errors.generic'
}

export function MembersPage() {
  const { t } = useTranslation()
  const { household, user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [members, setMembers] = useState<HouseholdUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('create')
  const [selected, setSelected] = useState<HouseholdUser | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isAdmin) {
      setMembers([])
      setLoading(false)
      setError(null)
      return
    }

    if (!household) {
      setMembers([])
      setLoading(false)
      setError(t('members.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await listHouseholdUsers(household.id)
      setMembers(rows)
    } catch (err) {
      setMembers(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else if (isApiError(err) && err.status === 403) {
        setError(t('members.errors.forbidden'))
      } else {
        setError(t('members.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [household, isAdmin, t])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!members) {
      return []
    }
    if (statusFilter === 'ALL') {
      return members
    }
    return members.filter((row) => row.status === statusFilter)
  }, [members, statusFilter])

  function openCreate() {
    setSheetMode('create')
    setSelected(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(member: HouseholdUser) {
    setSheetMode('edit')
    setSelected(member)
    setFormError(null)
    setSheetOpen(true)
  }

  function openResetPassword(member: HouseholdUser) {
    setSheetMode('resetPassword')
    setSelected(member)
    setFormError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    if (submitting) {
      return
    }
    setSheetOpen(false)
    setSelected(null)
    setFormError(null)
  }

  async function handleCreate(values: CreateHouseholdUserInput) {
    if (!household) {
      setFormError(t('members.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createHouseholdUser(household.id, values)
      toast.success(t('common.toast.created'))
      setSheetOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(memberErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(values: UpdateHouseholdUserInput) {
    if (!household || !selected) {
      setFormError(t('members.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await updateHouseholdUser(household.id, selected.id, values)
      toast.success(t('common.toast.updated'))
      setSheetOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(memberErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(temporaryPassword: string) {
    if (!household || !selected) {
      setFormError(t('members.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await assignTemporaryPassword(household.id, selected.id, temporaryPassword)
      toast.success(t('common.toast.passwordAssigned'))
      setSheetOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(t(memberErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(member: HouseholdUser, status: UserStatus) {
    if (!household) {
      setError(t('members.loadError'))
      return
    }

    setStatusBusyId(member.id)
    setError(null)
    try {
      await updateHouseholdUser(household.id, member.id, { status })
      toast.success(t('common.toast.updated'))
      await load()
    } catch (err) {
      setError(t(memberErrorKey(err)))
    } finally {
      setStatusBusyId(null)
    }
  }

  if (!isAdmin) {
    return (
      <section className="grid gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('members.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('members.subtitle')}
          </p>
        </div>
        <Alert>
          <AlertTitle>{t('members.title')}</AlertTitle>
          <AlertDescription>{t('members.adminOnly')}</AlertDescription>
        </Alert>
      </section>
    )
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('members.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('members.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle data-icon="inline-start" />
          {t('members.add')}
        </Button>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('members.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4" aria-hidden />
              {t('members.title')}
            </CardTitle>
            <CardDescription>
              {household
                ? `${household.name} · ${household.currency}`
                : t('members.subtitle')}
            </CardDescription>
          </div>
          <div className="grid gap-2 sm:w-48">
            <Label htmlFor="member-status-filter">
              {t('members.fields.status')}
            </Label>
            <select
              id="member-status-filter"
              className={selectClassName}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">{t('members.filters.allStatuses')}</option>
              <option value="ACTIVE">{t('members.statuses.ACTIVE')}</option>
              <option value="DISABLED">{t('members.statuses.DISABLED')}</option>
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
                  <TableHead>{t('members.fields.displayName')}</TableHead>
                  <TableHead>{t('members.fields.email')}</TableHead>
                  <TableHead>{t('members.fields.role')}</TableHead>
                  <TableHead>{t('members.fields.status')}</TableHead>
                  <TableHead>{t('members.fields.password')}</TableHead>
                  <TableHead>{t('members.fields.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => {
                  const busy = statusBusyId === member.id
                  const isActive = member.status === 'ACTIVE'
                  const isSelf = user?.id === member.id
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                          {member.displayName}
                          {isSelf ? (
                            <Badge variant="outline">{t('members.you')}</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {t(`members.roles.${member.role}`, {
                          defaultValue: member.role,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? 'secondary' : 'outline'}>
                          {t(`members.statuses.${member.status}`, {
                            defaultValue: member.status,
                          })}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.mustChangePassword
                          ? t('members.password.mustChange')
                          : member.passwordChangeCompleted
                            ? t('members.password.completed')
                            : t('members.password.pending')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || submitting}
                            onClick={() => openEdit(member)}
                          >
                            <Pencil data-icon="inline-start" />
                            {t('members.edit')}
                          </Button>
                          {!isSelf ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || submitting}
                                onClick={() => openResetPassword(member)}
                              >
                                <KeyRound data-icon="inline-start" />
                                {t('members.resetPassword')}
                              </Button>
                              {isActive ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || submitting}
                                  onClick={() =>
                                    void handleStatusChange(member, 'DISABLED')
                                  }
                                >
                                  <UserX data-icon="inline-start" />
                                  {busy
                                    ? t('members.form.updatingStatus')
                                    : t('members.disable')}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || submitting}
                                  onClick={() =>
                                    void handleStatusChange(member, 'ACTIVE')
                                  }
                                >
                                  <UserRound data-icon="inline-start" />
                                  {busy
                                    ? t('members.form.updatingStatus')
                                    : t('members.enable')}
                                </Button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={UsersRound}
              message={
                members && members.length > 0
                  ? t('members.filters.none')
                  : t('members.empty')
              }
            />
          )}
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet()
          }
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === 'create'
                ? t('members.form.createTitle')
                : sheetMode === 'edit'
                  ? t('members.form.editTitle')
                  : t('members.form.resetPasswordTitle')}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'create'
                ? t('members.form.createHint')
                : sheetMode === 'edit'
                  ? t('members.form.editHint')
                  : t('members.form.resetPasswordSheetHint')}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {sheetMode === 'resetPassword' ? (
              <TemporaryPasswordForm
                key={selected?.id ?? `reset-${String(sheetOpen)}`}
                submitting={submitting}
                error={formError}
                onSubmit={handleResetPassword}
                onCancel={closeSheet}
              />
            ) : (
              <MemberForm
                key={
                  sheetMode === 'edit' && selected
                    ? selected.id
                    : `create-${String(sheetOpen)}`
                }
                mode={sheetMode}
                member={selected}
                isSelf={Boolean(selected && user?.id === selected.id)}
                submitting={submitting}
                error={formError}
                onSubmitCreate={handleCreate}
                onSubmitEdit={handleEdit}
                onCancel={closeSheet}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
