'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { OnboardInput, RegisterInput, Session } from '@/lib/session';

/**
 * Client-side auth state. The access token lives only in memory; the refresh token is an
 * httpOnly cookie the browser sends automatically. On mount we call /auth/refresh once to
 * restore a session across reloads. All authed requests read the token via useAuthedFetch.
 */
interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Session>;
  register: (input: RegisterInput) => Promise<Session>;
  onboard: (input: OnboardInput) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Restore a session from the refresh cookie, if any.
    api
      .post<Session>('/auth/refresh')
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const s = await api.post<Session>('/auth/login', { email, password });
    setSession(s);
    return s;
  }, []);

  const register = React.useCallback(async (input: RegisterInput) => {
    const s = await api.post<Session>('/auth/register', input);
    setSession(s);
    return s;
  }, []);

  const onboard = React.useCallback(
    async (input: OnboardInput) => {
      const s = await api.post<Session>('/onboarding', input, {
        accessToken: session?.accessToken,
      });
      setSession(s);
      return s;
    },
    [session?.accessToken],
  );

  const logout = React.useCallback(async () => {
    await api.post('/auth/logout', undefined, { accessToken: session?.accessToken }).catch(() => {});
    setSession(null);
  }, [session?.accessToken]);

  const value = React.useMemo(
    () => ({ session, loading, login, register, onboard, logout }),
    [session, loading, login, register, onboard, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Access token accessor for authed API calls from feature code. */
export function useAccessToken(): string | undefined {
  return useAuth().session?.accessToken;
}
