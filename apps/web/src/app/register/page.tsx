'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/components/ui/icon';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', password: '' });
  const [consented, setConsented] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consented) {
      setError(t('register.consentError'));
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      });
      // A new account is created pending admin approval — nothing to log in to yet.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          <BrandMark size={64} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('register.approvalTitle')}</h1>
            <p className="text-slate-500">{t('register.approvalSubtitle')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface p-6">
          <p className="text-sm leading-relaxed text-slate-600">{t('register.approvalBody')}</p>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{t('register.approvalCost')}</p>
            <p className="mt-1 leading-relaxed">{t('register.approvalContact')}</p>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          {t('register.backToLogin')}
          <ArrowRight className="size-5" />
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10 flex items-center gap-4">
        <BrandMark size={64} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('register.title')}</h1>
          <p className="text-slate-500">{t('register.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Field label={t('register.name')}>
          <Input placeholder="Asha Mushi" value={form.name} onChange={set('name')} required />
        </Field>
        <Field label={t('register.email')}>
          <Input type="email" autoComplete="email" placeholder="asha@duka.co.tz" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label={t('register.phone')} hint="Optional">
          <Input placeholder="+255 700 000 000" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label={t('register.password')} hint={t('register.passwordHint')} error={error ?? undefined}>
          <PasswordInput autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={set('password')} required minLength={8} />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-hairline text-brand-600 focus:ring-brand-500"
            required
          />
          <span>
            {t('register.agree1')}{' '}
            <Link href="/terms" className="font-medium text-brand-700 hover:text-brand-800">{t('register.terms')}</Link>{' '}
            {t('register.and')}{' '}
            <Link href="/privacy" className="font-medium text-brand-700 hover:text-brand-800">{t('register.privacy')}</Link>
          </span>
        </label>

        <Button type="submit" loading={loading} className="w-full">
          {t('register.create')}
          <ArrowRight className="size-5" />
        </Button>
      </form>

      <div className="divider mt-10 pt-5 text-slate-500">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          {t('register.signIn')}
        </Link>
      </div>
    </main>
  );
}