import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Pencil, PlusCircle, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  createCategory,
  listCategories,
  updateCategory,
  updateCategoryStatus,
  type Category,
  type CategoryStatus,
} from '@/api/categories'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import {
  CategoryForm,
  type CategoryFormValues,
} from '@/components/categories/CategoryForm'
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
import { CategoryIconView } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
)

type SheetMode = 'create' | 'edit'
type StatusFilter = 'ALL' | CategoryStatus

function categoryErrorKey(err: unknown): string {
  if (err instanceof TypeError) {
    return 'common.offlineOrApi'
  }
  if (isApiError(err)) {
    if (err.status === 403) {
      return 'categories.errors.forbidden'
    }
    if (err.status === 409) {
      return 'categories.errors.duplicate'
    }
    if (err.status === 400) {
      return 'categories.errors.invalid'
    }
    if (err.status === 404) {
      return 'categories.errors.notFound'
    }
  }
  return 'categories.errors.generic'
}

export function CategoriesPage() {
  const { t } = useTranslation()
  const { household, user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('create')
  const [selected, setSelected] = useState<Category | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!household) {
      setCategories([])
      setLoading(false)
      setError(t('categories.loadError'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await listCategories(household.id, statusFilter)
      setCategories(rows)
    } catch (err) {
      setCategories(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else {
        setError(t('categories.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [household, statusFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  const nextSortOrder = useMemo(() => {
    if (!categories || categories.length === 0) {
      return 1
    }
    return Math.max(...categories.map((row) => row.sortOrder)) + 1
  }, [categories])

  function openCreate() {
    setSheetMode('create')
    setSelected(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setSheetMode('edit')
    setSelected(category)
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSubmit(values: CategoryFormValues) {
    if (!household) {
      setFormError(t('categories.loadError'))
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (sheetMode === 'create') {
        await createCategory(household.id, values)
        toast.success(t('common.toast.created'))
      } else if (selected) {
        await updateCategory(household.id, selected.id, values)
        toast.success(t('common.toast.updated'))
      }
      setSheetOpen(false)
      await load()
    } catch (err) {
      setFormError(t(categoryErrorKey(err)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(category: Category) {
    if (!household || !isAdmin) {
      return
    }

    const nextStatus: CategoryStatus =
      category.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'

    setStatusBusyId(category.id)
    setError(null)
    try {
      await updateCategoryStatus(household.id, category.id, nextStatus)
      toast.success(
        t(
          nextStatus === 'ARCHIVED'
            ? 'common.toast.archived'
            : 'common.toast.reactivated',
        ),
      )
      await load()
    } catch (err) {
      setError(t(categoryErrorKey(err)))
    } finally {
      setStatusBusyId(null)
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('categories.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('categories.subtitle')}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <PlusCircle data-icon="inline-start" />
            {t('categories.add')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <PageErrorAlert
          title={t('categories.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Tags className="size-4" aria-hidden />
                {t('categories.title')}
              </CardTitle>
              <CardDescription>
                {household
                  ? `${household.name} · ${household.currency}`
                  : t('categories.subtitle')}
              </CardDescription>
            </div>
            <div className="grid min-w-40 gap-1.5">
              <Label htmlFor="category-status-filter">
                {t('categories.filterStatus')}
              </Label>
              <select
                id="category-status-filter"
                className={selectClassName}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="ALL">{t('categories.filters.all')}</option>
                <option value="ACTIVE">
                  {t('categories.statuses.ACTIVE')}
                </option>
                <option value="ARCHIVED">
                  {t('categories.statuses.ARCHIVED')}
                </option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : categories && categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('categories.fields.name')}</TableHead>
                  <TableHead>{t('categories.fields.icon')}</TableHead>
                  <TableHead>{t('categories.fields.color')}</TableHead>
                  <TableHead>{t('categories.fields.sortOrder')}</TableHead>
                  <TableHead>{t('categories.fields.status')}</TableHead>
                  {isAdmin ? (
                    <TableHead>{t('categories.fields.actions')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="font-medium">{category.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <CategoryIconView
                            className="size-4"
                            iconKey={category.iconKey}
                            style={{ color: category.color }}
                          />
                          <span className="text-muted-foreground">
                            {t(`categories.icons.${category.iconKey}`, {
                              defaultValue: category.iconKey,
                            })}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-4 rounded-full border border-border"
                            style={{ backgroundColor: category.color }}
                            aria-hidden
                          />
                          <span className="font-mono text-xs">
                            {category.color}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{category.sortOrder}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            category.status === 'ACTIVE'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {t(`categories.statuses.${category.status}`, {
                            defaultValue: category.status,
                          })}
                        </Badge>
                      </TableCell>
                      {isAdmin ? (
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(category)}
                            >
                              <Pencil data-icon="inline-start" />
                              {t('categories.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={statusBusyId === category.id}
                              onClick={() => void handleToggleStatus(category)}
                            >
                              <Archive data-icon="inline-start" />
                              {category.status === 'ACTIVE'
                                ? t('categories.archive')
                                : t('categories.reactivate')}
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState icon={Tags} message={t('categories.empty')} />
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === 'create'
                ? t('categories.form.createTitle')
                : t('categories.form.editTitle')}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'create'
                ? t('categories.form.createHint')
                : t('categories.form.editHint')}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CategoryForm
              key={`${sheetMode}-${selected?.id ?? 'new'}-${sheetOpen}`}
              mode={sheetMode}
              category={selected}
              defaultSortOrder={nextSortOrder}
              submitting={submitting}
              error={formError}
              onSubmit={handleSubmit}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
