import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Package, Users, Sparkles, ArrowRight, BarChart3 } from '@/components/ui/icon';

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

      {/* Hero — split layout: copy left, real shop photo right (shadcn/21st.dev split-hero pattern). */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] rounded-full bg-brand-100/40 blur-[120px]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          {/* Copy */}
          <div>
            <span
              className="animate-rise inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3 py-1 text-sm font-medium text-slate-600"
              style={{ animationDelay: '20ms' }}
            >
              <span className="size-1.5 rounded-full bg-brand-500" />
              Built for Tanzanian shops
            </span>
            <h1
              className="animate-rise mt-6 text-[2.75rem] font-semibold leading-[1.03] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]"
              style={{ animationDelay: '80ms' }}
            >
              Sell faster.<br className="hidden sm:block" /> Track everything.{' '}
              <span className="text-brand-600">Know what’s next.</span>
            </h1>
            <p
              className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-slate-600"
              style={{ animationDelay: '140ms' }}
            >
              Beaver is the AI-powered operating system for your shop — point of sale, stock,
              customers and debts — with an assistant that studies your business and tells you what
              to do next.
            </p>
            <div
              className="animate-rise mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '200ms' }}
            >
              <Link
                href="/register"
                className="tap inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Get started free <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/login"
                className="tap inline-flex items-center rounded-xl border border-hairline px-6 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
            <p
              className="animate-rise mt-8 text-sm text-slate-500"
              style={{ animationDelay: '260ms' }}
            >
              Cash &amp; mobile money · Works on any phone · Kiswahili &amp; English
            </p>
          </div>

          {/* Photo */}
          <div className="animate-rise relative" style={{ animationDelay: '140ms' }}>
            <div aria-hidden className="absolute -inset-3 -z-10 rounded-[2rem] bg-brand-100/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.5rem] shadow-xl ring-1 ring-slate-900/5">
              <Image
                src="/hero-shop.jpg"
                alt="A shop owner at the counter of her retail shop in Dar es Salaam, Tanzania"
                width={1680}
                height={1120}
                priority
                sizes="(min-width: 1024px) 36rem, 100vw"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            {/* Floating metric pill — a taste of the live product */}
            <div className="absolute -bottom-4 -left-4 flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-lg ring-1 ring-slate-900/5">
              <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand-700">
                <BarChart3 className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="tabular block text-sm font-semibold text-slate-900">TZS 480,000</span>
                <span className="block text-xs text-slate-500">sales today</span>
              </span>
            </div>
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
