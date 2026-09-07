'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { Reveal } from '@/components/ui/reveal';
import { LandingNav } from '@/components/ui/landing-nav';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import { HowItWorks } from '@/components/landing/how-it-works';
import {
  ShoppingCart,
  Package,
  Users,
  Sparkles,
  ArrowRight,
  Check,
} from '@/components/ui/icon';

const FEATURES = [
  { icon: ShoppingCart, titleKey: 'landing.feat1.title', bodyKey: 'landing.feat1.body' },
  { icon: Package, titleKey: 'landing.feat2.title', bodyKey: 'landing.feat2.body' },
  { icon: Users, titleKey: 'landing.feat3.title', bodyKey: 'landing.feat3.body' },
  { icon: Sparkles, titleKey: 'landing.feat4.title', bodyKey: 'landing.feat4.body' },
];

const FAQ_KEYS = [
  { q: 'landing.faq1.q', a: 'landing.faq1.a' },
  { q: 'landing.faq2.q', a: 'landing.faq2.a' },
  { q: 'landing.faq3.q', a: 'landing.faq3.a' },
  { q: 'landing.faq4.q', a: 'landing.faq4.a' },
  { q: 'landing.faq5.q', a: 'landing.faq5.a' },
];

export default function LandingPage() {
  const { t } = useI18n();

  const TRUST = ['landing.trust1', 'landing.trust2', 'landing.trust3', 'landing.trust4'];

  return (
    <main className="relative min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-base-100/70 backdrop-blur transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Beaver home">
            <Image src="/beaver-mark.png" alt="" width={38} height={38} className="rounded-xl" priority />
            <span className="text-lg font-semibold tracking-tight text-base-content">Beaver</span>
          </Link>
          <LandingNav />
        </div>
      </header>

      {/* Hero — Aceternity interactive canvas-reveal dot background with overlaid copy. */}
      <section className="relative min-h-[34rem] overflow-hidden bg-base-100 sm:min-h-[38rem] lg:min-h-[44rem]">
        <CanvasRevealEffect
          containerClassName="absolute inset-0"
          showGradient={false}
          colors={[[3, 152, 85]]}
        />
        <div className="relative z-10 mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-center px-6 py-24 sm:min-h-[38rem] lg:min-h-[44rem]">
          <div className="max-w-2xl">
            <h1
              className="animate-rise text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-base-content sm:text-6xl lg:text-7xl"
              style={{ animationDelay: '0ms' }}
            >
              {t('landing.hero.titleA')}
              <br className="hidden sm:block" /> {t('landing.hero.titleB')}{' '}
              <span className="text-primary">{t('landing.hero.titleC')}</span>
            </h1>
            <p
              className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-base-content/70"
              style={{ animationDelay: '100ms' }}
            >
              {t('landing.hero.sub')}
            </p>
            <div
              className="animate-rise mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '180ms' }}
            >
              <Link
                href="/register"
                className="tap inline-flex items-center gap-2 rounded-xl btn btn-primary px-7 text-base font-medium shadow-sm transition-colors"
              >
                {t('landing.hero.ctaPrimary')} <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/login"
                className="tap inline-flex items-center rounded-xl border border-base-300 px-6 text-base font-medium text-base-content/80 transition-colors hover:bg-base-200"
              >
                {t('landing.hero.ctaSecondary')}
              </Link>
            </div>
            <p
              className="animate-rise mt-6 text-sm text-base-content/60"
              style={{ animationDelay: '240ms' }}
            >
              {t('landing.hero.trust')}
            </p>
          </div>
        </div>
      </section>

      {/* Trust band — real, verifiable claims only */}
      <section className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6">
          {TRUST.map((key) => (
            <span key={key} className="inline-flex items-center gap-2 text-sm font-medium text-base-content/70">
              <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5" />
              </span>
              {t(key)}
            </span>
          ))}
        </div>
      </section>

      {/* See it in action */}
      <section className="border-y border-base-300 bg-base-100">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{t('landing.feat.section')}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-base-content sm:text-4xl">
              {t('landing.feat.title')}
            </h2>
            <p className="mt-4 leading-relaxed text-base-content/60">
              {t('landing.feat.body')}
            </p>
            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.titleKey} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-4" />
                  </span>
                  <span className="text-base-content/80">
                    <span className="font-medium text-base-content">{t(f.titleKey)}.</span>{' '}                    {t(f.bodyKey)}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl border border-base-300 bg-base-100 p-2 shadow-[0_20px_60px_-20px_rgba(2,44,34,0.35)]">
              <div className="flex items-center gap-1.5 border-b border-base-300 px-4 py-3">
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="ml-2 font-mono text-xs text-base-content/50">app.beaver.shop</span>
              </div>
              <Image
                src="/app-preview.jpg"
                alt={t('landing.feat.imageAlt')}
                width={1200}
                height={900}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works — a continuous Modern Timeline (01 → 02 → 03). */}
      <HowItWorks />

      {/* FAQ */}
      <section className="border-y border-base-300 bg-base-200">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-base-content sm:text-4xl">{t('landing.faq.title')}</h2>
          </Reveal>
          <Reveal className="mt-8 divide-y divide-hairline" delay={120}>
            <div>
              {FAQ_KEYS.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-base-content [&::-webkit-details-marker]:hidden">
                    {t(item.q)}
                    <span className="shrink-0 text-base-content/50 transition-transform group-open:rotate-45" aria-hidden>
                      <Plus className="size-5" />
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-base-content/60">{t(item.a)}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-16 sm:flex-row sm:items-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-base-content">{t('landing.cta.title')}</h2>
            <p className="mt-2 text-base-content/60">{t('landing.cta.body')}</p>
          </Reveal>
          <Reveal delay={150}>
            <div className="flex items-center gap-3">
              <Link
                href="/register"
                className="tap inline-flex items-center gap-2 rounded-xl btn btn-primary px-7 text-base font-medium transition-colors"
              >
                {t('landing.cta.getStarted')} <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/login"
                className="tap inline-flex items-center rounded-xl px-6 text-base font-medium text-base-content/80 transition-colors hover:text-base-content"
              >
                {t('landing.cta.signIn')}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-base-300">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-base-content/50 sm:flex-row">
          <span className="flex items-center gap-2">
            <Image src="/beaver-mark.png" alt="" width={22} height={22} className="rounded-md" />
            © {new Date().getFullYear()} Beaver
          </span>
          <span>{t('landing.footer.tagline')}</span>
          <span className="flex items-center gap-4">
            <Link href="/terms" className="transition-colors hover:text-base-content/70">{t('landing.footer.terms')}</Link>
            <Link href="/privacy" className="transition-colors hover:text-base-content/70">{t('landing.footer.privacy')}</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
