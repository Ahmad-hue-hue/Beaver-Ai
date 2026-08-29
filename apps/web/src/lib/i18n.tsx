'use client';

import * as React from 'react';
import { Globe } from '@/components/ui/icon';

export type Locale = 'en' | 'sw';

type Dict = Record<string, string>;

const EN: Dict = {
  /* AppShell */
  'nav.dashboard': 'Dashboard',
  'nav.pos': 'Point of sale',
  'nav.sales': 'Sales',
  'nav.products': 'Products',
  'nav.customers': 'Customers',
  'nav.suppliers': 'Suppliers',
  'nav.purchases': 'Purchases',
  'nav.expenses': 'Expenses',
  'nav.cash': 'Cash',
  'nav.reports': 'Reports',
  'nav.assistant': 'Assistant',
  'nav.team': 'Team',
  'nav.settings': 'Settings',
  'nav.notifications': 'Notifications',
  'app.signOut': 'Sign out',
  'app.upgrade': 'Upgrade',
  'app.openMenu': 'Open menu',
  'app.closeMenu': 'Close menu',
  'app.billing': 'Billing',
  'upgrade.free.unlock': 'You’re on the Free plan. Unlock the AI assistant and premium reports.',
  'nav.locked.upgrade': 'Upgrade to unlock',

  /* Language */
  'lang.sw': 'Kiswahili',
  'lang.en': 'English (US)',

  /* Assistant page */
  'assistant.title': 'AI Chat',
  'assistant.subtitle': 'Ask anything about your shop — sales, stock, debt, cash and more.',
  'assistant.placeholder': 'Ask about your shop…',
  'assistant.send': 'Send',
  'assistant.attach': 'Attach a file',
  'assistant.history': 'History',
  'assistant.incognito': 'Incognito',
  'assistant.archive': 'Archive',
  'assistant.live': 'live',
  'assistant.offline': 'offline insights',
  'assistant.thinking': 'Thinking…',
  'assistant.locked.title': 'The AI assistant is a paid feature',
  'assistant.locked.body':
    'Your shop is on the Free plan, which doesn’t include the AI assistant. Upgrade to Basic or Pro to study the business, get restock alerts, and act on what matters.',
  'assistant.locked.cta': 'Upgrade in Billing',
  'assistant.ownerOnly': 'Only the workspace owner can change the plan.',
  'assistant.incognitoOn': 'Incognito — this thread isn’t saved',
  'assistant.clearThread': 'Clear this conversation',
  'assistant.history.title': 'History',
  'assistant.history.empty': 'No saved conversations yet.',
  'assistant.history.newChat': 'New chat',
  'assistant.history.noTitle': 'Untitled chat',
  'assistant.archive.title': 'Archive',
  'assistant.archive.empty': 'Nothing archived yet.',
  'assistant.archive.save': 'Save to archive',
  'assistant.archive.restore': 'Restore',
  'assistant.archive.none': 'No conversation to save.',
  'assistant.archive.clear': 'Clear archive',
  'assistant.attach.remove': 'Remove attachment',
  'assistant.attach.note': 'Attached: {name}',

  /* Notifications page */
  'notifications.title': 'Notifications',
  'notifications.unread': '{count} unread',
  'notifications.allCaughtUp': 'You’re all caught up',
  'notifications.markAllRead': 'Mark all read',
  'notifications.empty.title': 'Nothing to report',
  'notifications.empty.body':
    'AI insights — restock alerts, top sellers, debts and daily summaries — will appear here automatically.',
  'notifications.view': 'View',
  'notifications.markRead': 'Mark read',
  'notifications.justNow': 'just now',
  'notifications.minutesAgo': '{n}m ago',
  'notifications.hoursAgo': '{n}h ago',
  'notifications.yesterday': 'yesterday',
  'notifications.daysAgo': '{n}d ago',
};

const SW: Dict = {
  /* AppShell */
  'nav.dashboard': 'Dashibodi',
  'nav.pos': 'Sehemu ya mauzo',
  'nav.sales': 'Mauzo',
  'nav.products': 'Bidhaa',
  'nav.customers': 'Wateja',
  'nav.suppliers': 'Wauzaji',
  'nav.purchases': 'Ununuzi',
  'nav.expenses': 'Matumizi',
  'nav.cash': 'Fedha taslimu',
  'nav.reports': 'Ripoti',
  'nav.assistant': 'Msaidizi',
  'nav.team': 'Timu',
  'nav.settings': 'Mipangilio',
  'nav.notifications': 'Arifa',
  'app.signOut': 'Toka',
  'app.upgrade': 'Boresha',
  'app.openMenu': 'Fungua menyu',
  'app.closeMenu': 'Funga menyu',
  'app.billing': 'Malipo',
  'upgrade.free.unlock': 'Uko kwenye Mpango wa Bure. Fungua msaidizi wa AI na ripoti za kwanza.',
  'nav.locked.upgrade': 'Boresha ili kufungua',

  /* Language */
  'lang.sw': 'English (US)',
  'lang.en': 'Kiswahili',

  /* Assistant page */
  'assistant.title': 'Mazungumzo ya AI',
  'assistant.subtitle': 'Uliza chochote kuhusu duka lako — mauzo, hisa, deni, fedha taslimu na zaidi.',
  'assistant.placeholder': 'Uliza kuhusu duka lako…',
  'assistant.send': 'Tuma',
  'assistant.attach': 'Ambatisha faili',
  'assistant.history': 'Historia',
  'assistant.incognito': 'Siri',
  'assistant.archive': 'Kumbukumbu',
  'assistant.live': 'moja kwa moja',
  'assistant.offline': 'maoni ya nje ya mtandao',
  'assistant.thinking': 'Inafikiri…',
  'assistant.locked.title': 'Msaidizi wa AI ni kipengele cha malipo',
  'assistant.locked.body':
    'Duka lako liko kwenye Mpango wa Bure, ambao haujumuishi msaidizi wa AI. Boresha hadi Basic au Pro ili kusoma biashara yako, kupata tahadhari za kuhifadhi hisa, na kuchukua hatua.',
  'assistant.locked.cta': 'Boresha katika Malipo',
  'assistant.ownerOnly': 'Ni mmiliki pekee wa kazi anayeweza kubadilisha mpango.',
  'assistant.incognitoOn': 'Siri — mazungumzo haya hayahifadhiwi',
  'assistant.clearThread': 'Futa mazungumzo haya',
  'assistant.history.title': 'Historia',
  'assistant.history.empty': 'Hakuna mazungumzo yaliyohifadhiwa bado.',
  'assistant.history.newChat': 'Mazungumzo mapya',
  'assistant.history.noTitle': 'Mazungumzo bila kichwa',
  'assistant.archive.title': 'Kumbukumbu',
  'assistant.archive.empty': 'Hakuna kilichohifadhiwa bado.',
  'assistant.archive.save': 'Hifadhi kwenye kumbukumbu',
  'assistant.archive.restore': 'Rejesha',
  'assistant.archive.none': 'Hakuna mazungumzo ya kuhifadhi.',
  'assistant.archive.clear': 'Futa kumbukumbu',
  'assistant.attach.remove': 'Ondoa kiambatisho',
  'assistant.attach.note': 'Kiambatisho: {name}',

  /* Notifications page */
  'notifications.title': 'Arifa',
  'notifications.unread': '{count} hazijasomwa',
  'notifications.allCaughtUp': 'Umesoma zote',
  'notifications.markAllRead': 'Weka zote kama zimesomwa',
  'notifications.empty.title': 'Hakuna kitakachoripotiwa',
  'notifications.empty.body':
    'Maoni ya AI — tahadhari za hisa, bidhaa zinazoongoza, deni na muhtasari wa kila siku — zitaonekana hapa moja kwa moja.',
  'notifications.view': 'Angalia',
  'notifications.markRead': 'Weka kama imesomwa',
  'notifications.justNow': 'sasa hivi',
  'notifications.minutesAgo': '{n} dk zilizopita',
  'notifications.hoursAgo': '{n} saa zilizopita',
  'notifications.yesterday': 'jana',
  'notifications.daysAgo': '{n} siku zilizopita',
};

const DICTS: Record<Locale, Dict> = { en: EN, sw: SW };

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let str = DICTS[locale][key] ?? EN[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'beaver.locale';

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'sw' || stored === 'en' ? stored : 'en';
  });

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/* ───────────────────── Language toggle button ───────────────────── */

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === 'en' ? 'sw' : 'en';
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="tap inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      title={t('lang.en')}
      aria-label={t('lang.en')}
    >
      <Globe className="size-5" />
      <span className="hidden sm:inline">{locale === 'en' ? 'English' : 'Kiswahili'}</span>
    </button>
  );
}
