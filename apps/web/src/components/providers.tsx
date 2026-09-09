'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';
import { ThemeModeProvider } from '@/lib/theme';
import { ServiceWorkerRegistrar } from '@/components/sw-register';

/** App-wide client providers: theme + TanStack Query + auth session + i18n + service worker. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <I18nProvider>
          <ThemeModeProvider>
            <ServiceWorkerRegistrar />
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeModeProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { hasError: boolean };

/**
 * If one subtree throws at runtime (e.g. on an old browser), keep the rest of the
 * app alive and give the user a way to recover instead of a dead page.
 */
class ErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand-600">
            Something went wrong
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            This page hit a snag
          </h1>
          <p className="mt-3 text-slate-600">
            Try reloading. If it keeps happening, open this site in a newer browser.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-brand-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
