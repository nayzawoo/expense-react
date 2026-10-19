import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  CreateHouseholdUserInput,
  HouseholdUser,
  UpdateHouseholdUserInput,
  UserStatus,
} from '@/api/users'
import type { UserRole } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm',
)

const ROLES: UserRole[] = ['ADMIN', 'MEMBER']
const STATUSES: UserStatus[] = ['ACTIVE', 'DISABLED']
const MIN_PASSWORD_LENGTH = 8

export type MemberCreateValues = CreateHouseholdUserInput

export type MemberEditValues = {
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
}

type MemberFormProps = {
  mode: 'create' | 'edit'
  member?: HouseholdUser | null
  isSelf?: boolean
  submitting: boolean
  error: string | null
  onSubmitCreate?: (values: MemberCreateValues) => Promise<void>
  onSubmitEdit?: (values: UpdateHouseholdUserInput) => Promise<void>
  onCancel: () => void
}

function createDefaults(): MemberCreateValues {
  return {
    displayName: '',
    email: '',
    temporaryPassword: '',
    role: 'MEMBER',
  }
}

function editDefaults(member: HouseholdUser | null | undefined): MemberEditValues {
  return {
    displayName: member?.displayName ?? '',
    email: member?.email ?? '',
    role: (member?.role as UserRole) || 'MEMBER',
    status: (member?.status as UserStatus) || 'ACTIVE',
  }
}

export function MemberForm({
  mode,
  member,
  isSelf = false,
  submitting,
  error,
  onSubmitCreate,
  onSubmitEdit,
  onCancel,
}: MemberFormProps) {
  const { t } = useTranslation()
  const [createValues, setCreateValues] = useState<MemberCreateValues>(createDefaults)
  const [editValues, setEditValues] = useState<MemberEditValues>(() =>
    editDefaults(member),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  function updateCreate<K extends keyof MemberCreateValues>(
    key: K,
    value: MemberCreateValues[K],
  ) {
    setCreateValues((prev) => ({ ...prev, [key]: value }))
  }

  function updateEdit<K extends keyof MemberEditValues>(
    key: K,
    value: MemberEditValues[K],
  ) {
    setEditValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (mode === 'create') {
      const displayName = createValues.displayName.trim()
      const email = createValues.email.trim()
      const temporaryPassword = createValues.temporaryPassword

      if (!displayName) {
        setLocalError(t('members.form.displayNameRequired'))
        return
      }
      if (displayName.length > 120) {
        setLocalError(t('members.form.displayNameTooLong'))
        return
      }
      if (!email) {
        setLocalError(t('members.form.emailRequired'))
        return
      }
      if (!temporaryPassword || temporaryPassword.length < MIN_PASSWORD_LENGTH) {
        setLocalError(t('members.form.passwordTooShort'))
        return
      }
      if (!ROLES.includes(createValues.role)) {
        setLocalError(t('members.form.roleRequired'))
        return
      }

      await onSubmitCreate?.({
        displayName,
        email,
        temporaryPassword,
        role: createValues.role,
      })
      return
    }

    const displayName = editValues.displayName.trim()
    if (!displayName) {
      setLocalError(t('members.form.displayNameRequired'))
      return
    }
    if (displayName.length > 120) {
      setLocalError(t('members.form.displayNameTooLong'))
      return
    }

    const patch: UpdateHouseholdUserInput = { displayName }

    if (!isSelf) {
      const email = editValues.email.trim()
      if (!email) {
        setLocalError(t('members.form.emailRequired'))
        return
      }
      if (!ROLES.includes(editValues.role)) {
        setLocalError(t('members.form.roleRequired'))
        return
      }
      if (!STATUSES.includes(editValues.status)) {
        setLocalError(t('members.form.statusRequired'))
        return
      }
      patch.email = email
      patch.role = editValues.role
      patch.status = editValues.status
    }

    await onSubmitEdit?.(patch)
  }

  const displayError = localError ?? error

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      {displayError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('members.form.errorTitle')}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      {mode === 'create' ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="member-display-name">
              {t('members.fields.displayName')}
            </Label>
            <Input
              id="member-display-name"
              value={createValues.displayName}
              onChange={(event) => updateCreate('displayName', event.target.value)}
              disabled={submitting}
              maxLength={120}
              autoComplete="off"
              placeholder={t('members.form.displayNamePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-email">{t('members.fields.email')}</Label>
            <Input
              id="member-email"
              type="email"
              value={createValues.email}
              onChange={(event) => updateCreate('email', event.target.value)}
              disabled={submitting}
              autoComplete="off"
              placeholder={t('members.form.emailPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-temporary-password">
              {t('members.fields.temporaryPassword')}
            </Label>
            <Input
              id="member-temporary-password"
              type="password"
              value={createValues.temporaryPassword}
              onChange={(event) =>
                updateCreate('temporaryPassword', event.target.value)
              }
              disabled={submitting}
              autoComplete="new-password"
              placeholder={t('members.form.passwordPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('members.form.passwordHint')}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-role">{t('members.fields.role')}</Label>
            <select
              id="member-role"
              className={selectClassName}
              value={createValues.role}
              onChange={(event) =>
                updateCreate('role', event.target.value as UserRole)
              }
              disabled={submitting}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`members.roles.${role}`, { defaultValue: role })}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="member-edit-display-name">
              {t('members.fields.displayName')}
            </Label>
            <Input
              id="member-edit-display-name"
              value={editValues.displayName}
              onChange={(event) => updateEdit('displayName', event.target.value)}
              disabled={submitting}
              maxLength={120}
              autoComplete="off"
            />
          </div>

          {!isSelf ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="member-edit-email">
                  {t('members.fields.email')}
                </Label>
                <Input
                  id="member-edit-email"
                  type="email"
                  value={editValues.email}
                  onChange={(event) => updateEdit('email', event.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="member-edit-role">
                  {t('members.fields.role')}
                </Label>
                <select
                  id="member-edit-role"
                  className={selectClassName}
                  value={editValues.role}
                  onChange={(event) =>
                    updateEdit('role', event.target.value as UserRole)
                  }
                  disabled={submitting}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`members.roles.${role}`, { defaultValue: role })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="member-edit-status">
                  {t('members.fields.status')}
                </Label>
                <select
                  id="member-edit-status"
                  className={selectClassName}
                  value={editValues.status}
                  onChange={(event) =>
                    updateEdit('status', event.target.value as UserStatus)
                  }
                  disabled={submitting}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`members.statuses.${status}`, { defaultValue: status })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('members.form.selfEditHint')}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t('members.form.saving')
            : mode === 'create'
              ? t('members.form.create')
              : t('members.form.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
