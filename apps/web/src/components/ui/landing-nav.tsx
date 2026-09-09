'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { LanguageToggle, useI18n } from '@/lib/i18n';
import { Menu } from '@/components/ui/icon';

/** Landing-page navigation. Desktop shows links + language toggle inline;
 *  on small screens it collapses into a menu that opens *downward* from the
 *  hamburger button, keeping the header compact and never overflowing the
 *  small viewport.
 *
 *  The dropdown is positioned as a normal-flow sibling below the button so it
 *  is unaffected by the header's `backdrop-filter` (which would otherwise trap
 *  a `position: fixed` overlay). A full-screen transparent layer behind the
 *  panel closes the menu on outside click. */
export function LandingNav() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav className="hidden items-center gap-0.5 sm:gap-1.5 md:flex">
        <LanguageToggle />
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-4"
        >
          {t('landing.nav.signIn')}
        </Link>
        <Link
          href="/register"
          className="whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
        >
          {t('landing.nav.getStarted')}
        </Link>
      </nav>

      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t('app.openMenu')}
          aria-haspopup="menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Menu className="size-6" />
        </button>

        {open &&
          createPortal(
            <button
              type="button"
              aria-label={t('app.closeMenu')}
              onClick={close}
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
            />,
            document.body,
          )}

        {open && (
          <div
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-hairline bg-surface p-2 shadow-[0_20px_50px_-12px_rgba(2,44,34,0.35)]"
            role="menu"
            aria-label={t('landing.menu')}
          >
            <Link
              href="/login"
              onClick={close}
              role="menuitem"
              className="block rounded-xl px-3.5 py-2.5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              {t('landing.nav.signIn')}
            </Link>
            <Link
              href="/register"
              onClick={close}
              role="menuitem"
              className="mt-1 block rounded-xl bg-brand-600 px-3.5 py-2.5 text-center text-base font-medium text-white transition-colors hover:bg-brand-700"
            >
              {t('landing.nav.getStarted')}
            </Link>
            <div className="mt-2 border-t border-hairline pt-1">
              <LanguageToggle />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
