'use client';

import React from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/ui/reveal';
import { ShoppingCart, Package, Sparkles, ArrowRight } from '@/components/ui/icon';

const STEPS = [
  { n: '01', icon: ShoppingCart, titleKey: 'landing.step1.title', bodyKey: 'landing.step1.body' },
  { n: '02', icon: Package, titleKey: 'landing.step2.title', bodyKey: 'landing.step2.body' },
  { n: '03', icon: Sparkles, titleKey: 'landing.step3.title', bodyKey: 'landing.step3.body' },
] as const;

/**
 * "How it works" — a single continuous process (Modern Timeline pattern):
 * a vertical rail with status-styled icon nodes and an animated progress fill,
 * so steps 01 → 02 → 03 read as one connected journey.
 */
export function HowItWorks() {
  const { t } = useI18n();
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [progressed, setProgressed] = React.useState(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  React.useEffect(() => {
    const el = railRef.current;
    if (!el || progressed) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setProgressed(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="bg-base-100">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{t('landing.how.section')}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-base-content sm:text-4xl">
            {t('landing.how.title')}
          </h2>
          <p className="mt-3 text-base-content/60">{t('landing.how.body')}</p>
        </Reveal>

        <div ref={railRef} className="mt-14">
          <ol className="relative">
            {/* Timeline rail — continuous connector for the whole process. */}
            <div
              aria-hidden
              className="absolute left-[27px] top-3 bottom-3 w-px -translate-x-1/2 bg-primary/20 sm:left-[31px]"
            >
              {/* Animated progress fill (grows toward the node on scroll-in). */}
              <div
                className={cn(
                  'absolute inset-x-0 top-0 h-full origin-top bg-primary transition-transform duration-1000 ease-out',
                  progressed ? 'scale-y-100' : 'scale-y-0',
                )}
              />
            </div>

            {STEPS.map((s, i) => (
              <li key={s.n} className="relative">
                {i > 0 ? <div aria-hidden className="absolute left-[27px] top-0 bottom-0 w-px -translate-x-1/2 bg-primary/20 sm:left-[31px]" /> : null}
                <Reveal delay={i * 140}>
                  <div className="relative flex items-start gap-5 pb-10 last:pb-0 sm:gap-6">
                    {/* Icon node — sits on the rail. */}
                    <div className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 sm:size-16">
                      <s.icon className="size-7 sm:size-8" />
                    </div>
                    <div className="pt-1">
                      <p className="font-mono text-sm font-semibold text-primary">
                        {t('landing.how.step', { n: s.n })}
                      </p>
                      <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-base-content">{t(s.titleKey)}</h3>
                      <p className="mt-2 leading-relaxed text-base-content/60">{t(s.bodyKey)}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        <Reveal className="mt-12" delay={200}>
          <Link
            href="/register"
            className="tap inline-flex items-center gap-2 rounded-xl btn btn-primary px-7 text-base font-medium text-primary-content transition-colors hover:bg-primary hover:text-primary-content"
          >
            {t('landing.how.cta')} <ArrowRight className="size-5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
