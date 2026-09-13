'use client';

import * as React from 'react';
import { Download } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Install this app on your phone" control. On Android/desktop Chrome it waits
 * for `beforeinstallprompt` (fires once the site is installable) and invokes the
 * native install dialog; on iOS (no such event) it shows the menu path instead.
 */
export function InstallApp() {
  const { t } = useI18n();
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-center text-sm text-base-content/60">{t('install.done')}</p>;
  }

  if (deferred) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') setInstalled(true);
            setDeferred(null);
            setBusy(false);
          }}
          className="btn btn-soft btn-sm gap-2 text-base"
        >
          <Download className="size-4" />
          {busy ? t('install.working') : t('install.button')}
        </button>
        <p className="text-xs text-base-content/50">{t('install.hint')}</p>
      </div>
    );
  }

  return (
    <p className="text-center text-xs leading-relaxed text-base-content/50">{t('install.menuPath')}</p>
  );
}