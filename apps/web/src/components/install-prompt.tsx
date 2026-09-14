'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, X } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'beaver-install-banner-dismissed';

const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as unknown as { MSStream?: unknown }).MSStream;

/**
 * Automatic install banner for the home page (Supabase-style): once Chrome tells
 * us the site is installable it appears at the bottom; tapping "Install app"
 * opens the native install dialog. On iOS it shows the Add-to-Home-Screen path.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY) === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDone(true);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — offer the menu path shortly after load.
    if (isIOS) {
      const timer = setTimeout(() => setVisible(true), 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || done) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-hairline bg-white p-3 shadow-lg shadow-slate-900/10 sm:max-w-lg">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{t('install.popupTitle')}</p>
          <p className="truncate text-xs text-slate-500">{t('install.popupBody')}</p>
        </div>
        {deferred ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deferred.prompt();
              const choice = await deferred.userChoice;
              if (choice.outcome === 'accepted') setDone(true);
              setVisible(false);
              setBusy(false);
            }}
            className="tap btn btn-primary btn-sm gap-1.5 whitespace-nowrap text-sm"
          >
            <Download className="size-4" />
            {busy ? t('install.working') : t('install.button')}
          </button>
        ) : (
          <p className="max-w-[10rem] whitespace-normal text-xs leading-snug text-slate-500">
            {isIOS ? t('install.ios') : t('install.menuHint')}
          </p>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('install.later')}
          className="tap rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}