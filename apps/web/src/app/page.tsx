import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Package, Users, Sparkles, ArrowRight } from '@/components/ui/icon';

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

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-canvas/70 backdrop-blur transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/beaver-mark.png" alt="" width={38} height={38} className="rounded-xl" priority />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — full-bleed background photo with overlaid copy. */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/hero-shop.jpg"
          alt="A shop owner at the counter of her retail shop in Dar es Salaam, Tanzania"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        {/* Legibility overlays */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/25" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

        <div className="mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-center px-6 py-24 sm:min-h-[38rem] lg:min-h-[44rem]">
          <div className="max-w-2xl">
            <h1
              className="animate-rise text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ animationDelay: '20ms' }}
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
              className="animate-rise mt-8 text-sm text-slate-300"
              style={{ animationDelay: '240ms' }}
            >
              Cash &amp; mobile money · Works on any phone · Kiswahili &amp; English
            </p>
          </div>
        </div>
      </section>

      {/* Features — no cards; whitespace + generous rhythm. */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Everything the counter needs</p>
        <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{f.title}</h3>
              <p className="mt-1.5 leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-16 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Ready when you are.</h2>
            <p className="mt-2 text-slate-500">Set up your shop in a couple of minutes.</p>
          </div>
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-slate-400 sm:flex-row">
          <span className="flex items-center gap-2">
            <Image src="/beaver-mark.png" alt="" width={22} height={22} className="rounded-md" />
            © {new Date().getFullYear()} Beaver
          </span>
          <span>Smart. Simple. Powerful.</span>
        </div>
      </footer>
    </main>
  );
}
