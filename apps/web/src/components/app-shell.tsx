'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Bot,
  Coins,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X,
} from '@/components/ui/icon';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { LanguageToggle, useI18n } from '@/lib/i18n';

interface NavItem {
  href?: string;
  /** i18n key for the label. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  /** Only visible to the platform (SaaS-owner) admin. */
  adminOnly?: boolean;
}

const OWNER_MANAGER = ['OWNER', 'MANAGER'];
/** Roles that can use the AI assistant (matches packages/shared ROLE_PERMISSIONS). */
const AI_ROLES = OWNER_MANAGER;

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'nav.pos', icon: ShoppingCart },
  { href: '/sales', label: 'nav.sales', icon: Receipt },
  { href: '/products', label: 'nav.products', icon: Package },
  { href: '/customers', label: 'nav.customers', icon: Users },
  { href: '/suppliers', label: 'nav.suppliers', icon: Truck },
  { href: '/purchases', label: 'nav.purchases', icon: ShoppingBag },
  { href: '/expenses', label: 'nav.expenses', icon: Wallet },
  { href: '/cash', label: 'nav.cash', icon: Coins },
  { href: '/reports', label: 'nav.reports', icon: BarChart3 },
  { href: '/assistant', label: 'nav.assistant', icon: Bot, roles: AI_ROLES },
  { href: '/team', label: 'nav.team', icon: UserPlus, roles: OWNER_MANAGER },
  { href: '/settings', label: 'nav.settings', icon: Settings, roles: OWNER_MANAGER },
  { href: '/admin', label: 'nav.admin', icon: Shield, adminOnly: true },
];

/** Bell icon with an unread dot, wired to the notifications page. */
function NavBell({ count, label, onNavigate }: { count: number; label?: string; onNavigate?: () => void }) {
  return (
    <Link
      href="/notifications"
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
        label ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      <span className="relative">
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      {label && <span>{label}</span>}
    </Link>
  );
}

/** The main nav list — reused verbatim in the desktop sidebar and the mobile drawer. */
function NavRows({
  items,
  pathname,
  onSelect,
  t,
}: {
  items: NavItem[];
  pathname: string;
  onSelect?: () => void;
  t: (key: string) => string;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {items.map((item) => {
          if (!item.href) return null;
          const active = pathname.startsWith(item.href);
          const label = t(item.label);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onSelect}
                title={label}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <item.icon className="size-5" />
                <span className="truncate">{label}</span>
                {active && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-brand-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom rows (Notifications + language + Sign out) shared by sidebar and drawer. */
function SidebarFooter({
  unread,
  notificationsLabel,
  onSignOut,
  onNavigate,
}: {
  unread: number;
  notificationsLabel: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="border-t border-hairline p-3">
      <ul className="space-y-0.5">
        <li>
          <NavBell count={unread} label={notificationsLabel} onNavigate={onNavigate} />
        </li>
        <li>
          <LanguageToggle />
        </li>
        <li>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="size-5" />
            {t('app.signOut')}
          </button>
        </li>
      </ul>
    </div>
  );
}

/** Authenticated, responsive layout. Large screens get a persistent labeled sidebar;
    small screens use a top bar + left slide-in drawer (never a bottom sheet). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count', { accessToken: session?.accessToken }),
    enabled: !!session?.accessToken,
  });
  const unreadCount = unread.data?.count ?? 0;
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/login');
    else if (!session.businessId) router.replace('/onboarding');
  }, [loading, session, router]);

  // Esc closes the drawer; lock scroll while it's open.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (loading || !session?.businessId) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <BrandMark size={44} className="animate-pulse" />
      </div>
    );
  }

  const signOut = () => logout().then(() => router.replace('/login'));
  const role = session.role;

  // Keep every nav item visible. Roles gate privileged items; platform admin sees the admin console.
  const items = NAV.filter((item) => {
    if (item.adminOnly && !session.user.isPlatformAdmin) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });

  const close = () => setMenuOpen(false);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ─── Persistent sidebar — large screens only ─── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-hairline bg-surface lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark size={36} />
          <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
        </Link>
        <NavRows items={items} pathname={pathname} t={t} />
        <SidebarFooter unread={unreadCount} notificationsLabel={t('nav.notifications')} onSignOut={signOut} />
      </aside>

      {/* ─── Top bar — small/medium screens only ─── */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-hairline bg-surface/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={t('app.openMenu')}
            className="grid size-10 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Menu className="size-6" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <NavBell count={unreadCount} />
        </div>
      </header>

      <main className="min-w-0 px-5 pb-12 pt-6 sm:px-8 sm:pb-14 lg:px-10 lg:pt-8">{children}</main>

      {/* ─── Left slide-in drawer — small/medium screens ─── */}
      <div
        className={cn('fixed inset-0 z-40 lg:hidden', !menuOpen && 'pointer-events-none')}
        role="dialog"
        aria-modal="true"
        aria-hidden={!menuOpen}
        aria-label="Menu"
      >
        <div
          className={cn(
            'absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={close}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-hairline pr-3">
            <Link href="/dashboard" onClick={close} className="flex items-center gap-2.5 px-5 py-5">
              <BrandMark size={32} />
              <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
            </Link>
            <button
              onClick={close}
              aria-label={t('app.closeMenu')}
              className="grid size-10 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-6" />
            </button>
          </div>
          <NavRows items={items} pathname={pathname} onSelect={close} t={t} />
          <SidebarFooter
            unread={unreadCount}
            notificationsLabel={t('nav.notifications')}
            onSignOut={signOut}
            onNavigate={close}
          />
        </div>
      </div>
    </div>
  );
}
