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

interface NavItem {
  href?: string;
  label: string;
  /** Shorter label for the mobile bottom tab bar. */
  short?: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  accent?: boolean;
  roles?: string[];
}

const OWNER_MANAGER = ['OWNER', 'MANAGER'];

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { href: '/pos', label: 'Point of sale', short: 'Sell', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Receipt },
  { href: '/products', label: 'Products', short: 'Items', icon: Package },
  { href: '/customers', label: 'Customers', short: 'Debts', icon: Users },
  { href: '/suppliers', label: 'Suppliers', short: 'Supply', icon: Truck },
  { href: '/purchases', label: 'Purchases', short: 'Buy', icon: ShoppingBag },
  { href: '/expenses', label: 'Expenses', short: 'Spend', icon: Wallet },
  { href: '/cash', label: 'Cash', short: 'Cash', icon: Coins },
  { href: '/reports', label: 'Reports', short: 'Reports', icon: BarChart3 },
  { href: '/assistant', label: 'Assistant', short: 'AI', icon: Bot },
  { href: '/team', label: 'Team', short: 'Team', icon: UserPlus, roles: OWNER_MANAGER },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: Settings, roles: OWNER_MANAGER },
];

/** Bell with an unread dot, wired to the notifications page. */
function NavBell({ count }: { count: number }) {
  return (
    <Link href="/notifications" className="group relative" aria-label="Notifications">
      <span
        className={cn(
          'grid size-13 place-items-center rounded-[0.85rem] transition-colors',
          count > 0
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
        )}
      >
        <Bell className="size-6" />
      </span>
      {count > 0 && (
        <span className="absolute right-2 top-2 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

/** Authenticated layout: slim icon rail + content. Guards the session, redirects if absent. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading, logout } = useAuth();
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

  if (loading || !session?.businessId) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <BrandMark size={44} className="animate-pulse" />
      </div>
    );
  }

  const signOut = () => logout().then(() => router.replace('/login'));
  const role = session.role;
  const items = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  // Phone bottom bar shows Home + Sell quick tabs; everything else lives in the Menu sheet.
  const MOBILE_PRIMARY = ['/dashboard', '/pos'];
  const primary = items.filter((item) => item.href && MOBILE_PRIMARY.some((p) => item.href!.startsWith(p)));
  const menuItems = items.filter((item) => !primary.includes(item));
  const primaryActive = primary.some((item) => item.href && pathname.startsWith(item.href));

  return (
    <div className="min-h-dvh sm:grid sm:grid-cols-[76px_1fr]">
      {/* Tablet / desktop: slim icon rail */}
      <nav className="sticky top-0 hidden h-dvh flex-col items-center gap-1 border-r border-hairline py-6 sm:flex">
        <BrandMark size={44} className="mb-4" />
        {items.map((item) => {
          const active = item.href && pathname.startsWith(item.href);
          const content = (
            <span
              className={cn(
                'grid size-13 place-items-center rounded-[0.85rem] transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : item.soon
                    ? 'text-slate-300'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
              )}
              title={item.soon ? `${item.label} — coming soon` : item.label}
            >
              <item.icon className="size-6" />
            </span>
          );
          return item.href ? (
            <Link key={item.label} href={item.href}>
              {content}
            </Link>
          ) : (
            <div key={item.label} className="cursor-default">
              {content}
            </div>
          );
        })}

        <NavBell count={unreadCount} />

        <button
          onClick={signOut}
          className="mt-auto grid size-13 place-items-center rounded-[0.85rem] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Sign out"
        >
          <LogOut className="size-5" />
        </button>
      </nav>

      <main className="min-w-0 px-5 pb-24 pt-6 sm:px-10 sm:py-10">{children}</main>

      {/* Phone: bottom tab bar — Home + Sell quick tabs + Menu sheet */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {primary.map((item) => {
          const active = item.href && pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-brand-700' : 'text-slate-400',
              )}
            >
              <item.icon className="size-6" />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
            primaryActive ? 'text-slate-400' : 'text-brand-700',
          )}
        >
          <Menu className="size-6" />
          Menu
        </button>
      </nav>

      {menuOpen && (
        <MenuSheet
          items={menuItems}
          pathname={pathname}
          unread={unreadCount}
          onNavigate={() => setMenuOpen(false)}
          onSignOut={signOut}
        />
      )}
    </div>
  );
}

/** A single tap row inside the More sheet: label + icon, active dot/badge, tap-to-navigate. */
function MoreRow({
  icon: Icon,
  label,
  href,
  badge,
  pathname,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  badge?: React.ReactNode;
  pathname: string;
  onSelect?: () => void;
}) {
  const active = href && pathname.startsWith(href);
  const body = (
    <span className="flex items-center gap-3.5">
      <Icon className="size-5 text-slate-400" />
      <span className="font-medium text-slate-700">{label}</span>
      <span className="ml-auto">{badge ?? (active ? <span className="size-1.5 rounded-full bg-brand-600" /> : null)}</span>
    </span>
  );
  return href ? (
    <Link href={href} onClick={onSelect} className="block px-3 py-3.5 active:bg-slate-50">
      {body}
    </Link>
  ) : (
    <button onClick={onSelect} className="block w-full px-3 py-3.5 text-left active:bg-slate-50">
      {body}
    </button>
  );
}

/** Full-screen bottom sheet listing every non-primary nav item plus Notifications and Sign out. */
function MenuSheet({
  items,
  pathname,
  unread,
  onNavigate,
  onSignOut,
}: {
  items: NavItem[];
  pathname: string;
  unread: number;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onNavigate} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface px-5 py-4">
          <p className="font-medium text-slate-900">Menu</p>
          <button
            onClick={onNavigate}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-[0.85rem] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </header>
        <nav className="px-2 py-2">
          <div className="divide-y divide-hairline">
            {items
              .filter((item) => item.href)
              .map((item) => (
                <MoreRow key={item.label} icon={item.icon} label={item.label} href={item.href} pathname={pathname} onSelect={onNavigate} />
              ))}
            <MoreRow
              icon={Bell}
              label="Notifications"
              href="/notifications"
              pathname={pathname}
              onSelect={onNavigate}
              badge={
                unread > 0 ? (
                  <span className="rounded-full bg-red-500 px-1.5 font-mono text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : undefined
              }
            />
          </div>
          <div className="mt-2 border-t border-hairline">
            <MoreRow icon={LogOut} label="Sign out" pathname={pathname} onSelect={onSignOut} />
          </div>
        </nav>
      </div>
    </div>
  );
}
