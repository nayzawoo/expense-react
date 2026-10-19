import { useCallback, useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { listAccounts } from '@/api/accounts'
import { isApiError } from '@/api/errors'
import type { Account } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { PageEmptyState } from '@/components/PageEmptyState'
import { PageErrorAlert } from '@/components/PageErrorAlert'
import { PageLoading } from '@/components/PageLoading'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '@/lib/money'

export function AccountsPage() {
  const { t } = useTranslation()
  const { household } = useAuth()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      const rows = await listAccounts(household.id)
      setAccounts(rows)
    } catch (err) {
      setAccounts(null)
      if (err instanceof TypeError) {
        setError(t('common.offlineOrApi'))
      } else if (isApiError(err)) {
        setError(t('accounts.loadError'))
      } else {
        setError(t('accounts.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [household, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('accounts.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
      </div>

      {error ? (
        <PageErrorAlert
          title={t('accounts.title')}
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" aria-hidden />
            {t('accounts.title')}
          </CardTitle>
          <CardDescription>
            {household
              ? `${household.name} · ${household.currency}`
              : t('accounts.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : accounts && accounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('accounts.name')}</TableHead>
                  <TableHead>{t('accounts.type')}</TableHead>
                  <TableHead>{t('accounts.owner')}</TableHead>
                  <TableHead>{t('accounts.balance')}</TableHead>
                  <TableHead>{t('accounts.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <PageEmptyState
              icon={Wallet}
              message={t('accounts.empty')}
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
