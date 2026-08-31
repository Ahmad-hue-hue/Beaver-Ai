'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from '@/components/ui/icon';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const s = await login(email, password);
      router.replace(s.businessId ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10 flex items-center gap-4">
        <BrandMark size={64} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('login.welcome')}</h1>
          <p className="text-slate-500">{t('login.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-7">
        <Field label={t('login.email')}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="asha@duka.co.tz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={t('login.password')} error={error ?? undefined}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          {t('login.signIn')}
          <ArrowRight className="size-5" />
        </Button>
      </form>

      <div className="divider mt-10 pt-5 text-slate-500">
        {t('login.newHere')}{' '}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          {t('login.createAccount')}
        </Link>
      </div>
    </main>
  );
}
