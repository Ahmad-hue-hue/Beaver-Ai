'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { LanguageToggle, useI18n } from '@/lib/i18n';
import { Menu } from '@/components/ui/icon';

const PANEL_WIDTH = 256; // matches w-64
const PANEL_GAP = 8;

/** Landing-page navigation. Desktop shows links + language toggle inline;
 *  on small screens it collapses into a menu that opens below the hamburger.
 *
 *  The dropdown and its full-viewport close-layer live in a portal on
 *  <body>, above the sticky header (sticky z-40 + backdrop-blur). The
 *  close-layer is `fixed inset-0` on the body so outside taps anywhere on the
 *  page close the menu — a `fixed` layer rendered inside the header would be
 *  confined to the header's backdrop-filter containing block. */
export function LandingNav() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<{ left: number; top: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  // Esc closes the menu; also close if the page scrolls or resizes so the
  // viewport-anchored panel never ends up detached from the button.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next && buttonRef.current) {
        const r = buttonRef.current.getBoundingClientRect();
        const right = r.right + PANEL_GAP;
        setAnchor({
          left: Math.max(PANEL_GAP, right - PANEL_WIDTH),
          top: r.bottom + PANEL_GAP,
        });
      }
      return next;
    });
  };

  const panel =
    open && anchor
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t('app.closeMenu')}
              aria-hidden="true"
              onClick={close}
              tabIndex={-1}
              className="fixed inset-0 z-[45] cursor-default"
            />
            <div
              role="menu"
              aria-label={t('landing.menu')}
              className="fixed z-[50] w-64 rounded-2xl border border-hairline bg-surface p-2 shadow-[0_20px_50px_-12px_rgba(2,44,34,0.35)]"
              style={{ left: anchor.left, top: anchor.top }}
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
          </>,
          document.body,
        )
      : null;

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
          ref={buttonRef}
          type="button"
          onClick={toggle}
          aria-label={t('app.openMenu')}
          aria-haspopup="menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Menu className="size-6" />
        </button>
      </div>

      {panel}
    </>
  );
}