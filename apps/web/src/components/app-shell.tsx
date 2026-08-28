'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bot,
  Coins,
  Invoice,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from '@/components/ui/icon';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  href?: string;
  label: string;
  /** Shorter label for the mobile bottom tab bar. */
  short?: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  accent?: boolean;
}

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
  { label: 'Reports', icon: BarChart3, soon: true },
];

/** Authenticated layout: slim icon rail + content. Guards the session, redirects if absent. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  return (
    <div className="min-h-dvh sm:grid sm:grid-cols-[76px_1fr]">
      {/* Tablet / desktop: slim icon rail */}
      <nav className="sticky top-0 hidden h-dvh flex-col items-center gap-1 border-r border-hairline py-6 sm:flex">
        <BrandMark size={44} className="mb-4" />
        {NAV.map((item) => {
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

        <span className="mt-auto grid size-13 place-items-center rounded-[0.85rem] text-brand-600" title="AI assistant — coming soon">
          <Bot className="size-6" />
        </span>
        <button
          onClick={signOut}
          className="grid size-13 place-items-center rounded-[0.85rem] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Sign out"
        >
          <LogOut className="size-5" />
        </button>
      </nav>

      <main className="min-w-0 px-5 pb-24 pt-6 sm:px-10 sm:py-10">{children}</main>

      {/* Phone: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {NAV.filter((item) => item.href).map((item) => {
          const active = pathname.startsWith(item.href!);
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
          onClick={signOut}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-slate-400"
        >
          <LogOut className="size-6" />
          Sign out
        </button>
      </nav>
    </div>
  );
}
