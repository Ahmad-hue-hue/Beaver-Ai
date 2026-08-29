import Link from 'next/link';
import Image from 'next/image';
import { Reveal } from '@/components/ui/reveal';
import {
  ShoppingCart,
  Package,
  Users,
  Sparkles,
  ArrowRight,
  Check,
} from '@/components/ui/icon';

const FEATURES = [
  {
    icon: ShoppingCart,
    title: 'Point of sale',
    body: 'Ring up sales in seconds — cash, mobile money, or credit — and print a receipt.',
  },
  {
    icon: Package,
    title: 'Stock control',
    body: 'See what’s in stock and what to reorder before you ever run out.',
  },
  {
    icon: Users,
    title: 'Customers & debt',
    body: 'Track who owes you and settle balances with a single tap.',
  },
  {
    icon: Sparkles,
    title: 'AI insight',
    body: 'An assistant that studies your shop and tells you what to do next.',
  },
];

const STEPS = [
  {
    n: '01',
    icon: ShoppingCart,
    title: 'Ring up a sale',
    body: 'Add items, take cash or mobile money, and print a receipt — in seconds.',
  },
  {
    n: '02',
    icon: Package,
    title: 'Track stock & debt',
    body: 'Stock levels and reorder points update automatically. Balances stay current.',
  },
  {
    n: '03',
    icon: Sparkles,
    title: 'Let AI tell you what’s next',
    body: 'Beaver studies your business and flags restocks, slow movers and debts to chase.',
  },
];

const TRUST = [
  '14-day full trial',
  'No card required',
  'English & Kiswahili',
  'Works on any phone',
];

const FAQ = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Sign up free and get every feature for 14 days without entering a card.',
  },
  {
    q: 'Does the free plan really stay free?',
    a: 'Yes. After the trial you can stay on the free plan with a generous product limit and core features — no surprise charges.',
  },
  {
    q: 'Is Beaver in Kiswahili?',
    a: 'Yes. You can switch the whole app between English (US) and Kiswahili any time.',
  },
  {
    q: 'Can I print receipts?',
    a: 'Yes — thermal receipt printing is built in, and every sale is stored for reports.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Plans are upgraded in Billing. Right now upgrade is handled manually with our team — just tell us when you want the switch.',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-canvas/70 backdrop-blur transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Beaver home">
            <Image src="/beaver-mark.png" alt="" width={38} height={38} className="rounded-xl" priority />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1.5">
            <Link
              href="/pricing"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-4"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — full-bleed background photo with overlaid copy. */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        <Image
          src="/hero-shop.jpg"
          alt="A customer paying at a retail checkout terminal"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        {/* Legibility overlays */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/30" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        <div className="mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-center px-6 py-24 sm:min-h-[38rem] lg:min-h-[44rem]">
          <div className="max-w-2xl">
            <h1
              className="animate-rise text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ animationDelay: '0ms' }}
            >
              Sell faster.<br className="hidden sm:block" /> Track everything.{' '}
              <span className="text-brand-300">Know what’s next.</span>
            </h1>
            <p
              className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-slate-200"
              style={{ animationDelay: '100ms' }}
            >
              Beaver is the AI-powered operating system for your shop — point of sale, stock,
              customers and debts — with an assistant that studies your business and tells you what
              to do next.
            </p>
            <div
              className="animate-rise mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '180ms' }}
            >
              <Link
                href="/register"
                className="tap inline-flex items-center gap-2 rounded-xl bg-white px-7 text-base font-medium text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
              >
                Get started free <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/login"
                className="tap inline-flex items-center rounded-xl border border-white/40 px-6 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
            <p
              className="animate-rise mt-6 text-sm text-slate-300"
              style={{ animationDelay: '240ms' }}
            >
              Free plan · No card required · 14-day full trial
            </p>
          </div>
        </div>
      </section>

      {/* Trust band — real, verifiable claims only */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6">
          {TRUST.map((item) => (
            <span key={item} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="grid size-5 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Check className="size-3.5" />
              </span>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* See it in action */}
      <section className="border-y border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand-600">See it in action</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              One screen for the whole shop.
            </h2>
            <p className="mt-4 leading-relaxed text-slate-500">
              Count stock, run the counter, and chase what’s owed — without juggling ten apps or a
              paper notebook.
            </p>
            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <f.icon className="size-4" />
                  </span>
                  <span className="text-slate-700">
                    <span className="font-medium text-slate-900">{f.title}.</span>{' '}
                    {f.body}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl border border-hairline bg-white p-2 shadow-[0_20px_60px_-20px_rgba(2,44,34,0.35)]">
              <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3">
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="size-3 rounded-full bg-slate-200" />
                <span className="ml-2 font-mono text-xs text-slate-400">app.beaver.shop</span>
              </div>
              <Image
                src="/app-preview.jpg"
                alt="Beaver app preview — a retail shop at work"
                width={1200}
                height={900}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand-600">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              From first sale to sharp decisions
            </h2>
            <p className="mt-3 text-slate-500">
              Three steps. No training course, no manual, no fuss.
            </p>
          </Reveal>

          <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n}>
                <Reveal delay={i * 120}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-brand-600">
                      Step {s.n}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-brand-200/70 to-transparent" />
                  </div>
                  <div className="mt-6 inline-grid size-12 place-items-center rounded-xl bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(3,152,85,0.7)]">
                    <s.icon className="size-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-500">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>

          <Reveal className="mt-14" delay={200}>
            <Link
              href="/register"
              className="tap inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 text-base font-medium text-white transition-colors hover:bg-brand-700"
            >
              Start with step one <ArrowRight className="size-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-hairline bg-canvas">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Questions, answered.</h2>
          </Reveal>
          <Reveal className="mt-8 divide-y divide-hairline" delay={120}>
            <div>
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-45" aria-hidden>
                      <Plus className="size-5" />
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-slate-500">{item.a}</p>
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
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Ready when you are.</h2>
            <p className="mt-2 text-slate-500">Set up your shop in a couple of minutes — free, no card required.</p>
          </Reveal>
          <Reveal delay={150}>
            <div className="flex items-center gap-3">
              <Link
                href="/register"
                className="tap inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 text-base font-medium text-white transition-colors hover:bg-brand-700"
              >
                Get started <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/login"
                className="tap inline-flex items-center rounded-xl px-6 text-base font-medium text-slate-700 transition-colors hover:text-slate-900"
              >
                Sign in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-400 sm:flex-row">
          <span className="flex items-center gap-2">
            <Image src="/beaver-mark.png" alt="" width={22} height={22} className="rounded-md" />
            © {new Date().getFullYear()} Beaver
          </span>
          <span>Smart. Simple. Powerful.</span>
          <span className="flex items-center gap-4">
            <Link href="/terms" className="transition-colors hover:text-slate-600">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-slate-600">Privacy</Link>
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
