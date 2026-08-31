'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';

import { useI18n } from '@/lib/i18n';

export default function OnboardingPage() {
  const { session, loading: authLoading, onboard } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const TYPES: { value: string; label: string }[] = [
    { value: 'GROCERY', label: t('onboarding.type.grocery') },
    { value: 'RETAIL', label: t('onboarding.type.retail') },
    { value: 'WHOLESALE', label: t('onboarding.type.wholesale') },
    { value: 'PHARMACY', label: t('onboarding.type.pharmacy') },
    { value: 'ELECTRONICS', label: t('onboarding.type.electronics') },
    { value: 'HARDWARE', label: t('onboarding.type.hardware') },
    { value: 'RESTAURANT', label: t('onboarding.type.restaurant') },
    { value: 'OTHER', label: t('onboarding.type.other') },
  ];
  const [form, setForm] = React.useState({ name: '', type: 'GROCERY', currency: 'TZS', country: 'TZ' });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Already onboarded or signed out → send to the right place.
  React.useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace('/login');
    else if (session.businessId) router.replace('/dashboard');
  }, [authLoading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onboard(form);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium tracking-wide text-slate-400">{t('onboarding.eyebrow')}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{t('onboarding.title')}</h1>
      <p className="mt-1 text-slate-500">{t('onboarding.subtitle')}</p>

      <form onSubmit={onSubmit} className="mt-10 space-y-7">
        <Field label={t('onboarding.name')}>
          <Input placeholder="Duka la Asha" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>
        <Field label={t('onboarding.type')}>
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {TYPES.map((typ) => (
              <option key={typ.value} value={typ.value}>
                {typ.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label={t('onboarding.currency')}>
            <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
          </Field>
          <Field label={t('onboarding.country')} error={error ?? undefined}>
            <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))} maxLength={2} />
          </Field>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {t('onboarding.submit')}
          <ArrowRight className="size-5" />
        </Button>
      </form>
    </main>
  );
}
