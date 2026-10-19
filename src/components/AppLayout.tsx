import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
import { AppSidebarNav } from '@/components/AppSidebarNav'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const showNav = !user?.mustChangePassword

  useEffect(() => {
    const lang = (i18n.resolvedLanguage ?? i18n.language).startsWith('my')
      ? 'my'
      : 'en'
    document.documentElement.lang = lang
  }, [i18n.language, i18n.resolvedLanguage])

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          {showNav ? (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    aria-label={t('nav.menu')}
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>{t('app.name')}</SheetTitle>
                  <SheetDescription>{t('app.tagline')}</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <AppSidebarNav onNavigate={() => setMenuOpen(false)} />
                  <Separator />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMenuOpen(false)
                      void logout()
                    }}
                  >
                    <LogOut data-icon="inline-start" />
                    {t('nav.logout')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : null}

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-lg bg-primary shadow-sm"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {t('app.name')}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.displayName ?? t('app.tagline')}
              </p>
            </div>
          </div>

          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        {showNav ? (
          <aside className="sticky top-20 hidden h-[calc(100svh-6rem)] w-56 shrink-0 flex-col gap-4 md:flex">
            <AppSidebarNav />
            <Separator />
            <button
              type="button"
              className={cn(buttonVariants({ variant: 'outline' }), 'justify-center')}
              onClick={() => {
                void logout()
              }}
            >
              <LogOut data-icon="inline-start" />
              {t('nav.logout')}
            </button>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
