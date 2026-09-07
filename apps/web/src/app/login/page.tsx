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
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [autofillLock, setAutofillLock] = React.useState(true);

  const unlockAutofill = () => {
    if (autofillLock) setAutofillLock(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const s = await login(phone, password);
      // Platform admins belong to their own console, not the shop.
      router.replace(s.user.isPlatformAdmin ? '/admin' : s.businessId ? '/dashboard' : '/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_PENDING') {
          setError(t('login.pending'));
          return;
        }
        if (err.code === 'ACCOUNT_EXPIRED') {
          setError(t('login.expired'));
          return;
        }
        setError(err.message);
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10 flex items-center gap-4">
        <BrandMark size={64} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-base-content">{t('login.welcome')}</h1>
          <p className="text-base-content/60">{t('login.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-7" autoComplete="off">
        <Field label={t('login.phone')}>
          <Input
            type="tel"
            name="phone"
            autoComplete="off"
            inputMode="tel"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="+255 774 899 262"
            value={phone}
            readOnly={autofillLock}
            onFocus={unlockAutofill}
            onPointerDown={unlockAutofill}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Field label={t('login.password')} error={error ?? undefined}>
          <PasswordInput
            name="password"
            autoComplete="off"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            readOnly={autofillLock}
            onFocus={unlockAutofill}
            onPointerDown={unlockAutofill}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          {t('login.signIn')}
          <ArrowRight className="size-5" />
        </Button>
      </form>

      <div className="divider mt-10 pt-5 text-base-content/60">
        {t('login.newHere')}{' '}
        <Link href="/register" className="font-medium text-primary hover:text-primary">
          {t('login.createAccount')}
        </Link>
      </div>
    </main>
  );
}
