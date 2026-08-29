import Link from 'next/link';
import Image from 'next/image';
import { Check, Sparkles, Bot, BarChart3, Coins } from '@/components/ui/icon';
import { PlanCta } from '@/components/plan-cta';
import { PricingActions, TrialCta } from '@/components/pricing-actions';

interface Plan {
  key: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  currency: string;
  features: string[];
  productLimit: number | null;
  highlighted?: boolean;
}

interface FeatureMeta {
  key: string;
  label: string;
} 

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getPlans(): Promise<{ plans: Plan[]; features: FeatureMeta[] }> {
  try {
    const [plansRes, featuresRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/billing/plans`, { cache: 'no-store' }),
      fetch(`${API_URL}/api/v1/billing/features`, { cache: 'no-store' }),
    ]);
    const plans = plansRes.ok ? ((await plansRes.json()) as Plan[]) : [];
    const features = featuresRes.ok ? ((await featuresRes.json()) as FeatureMeta[]) : [];
    return { plans, features };
  } catch {
    return { plans: [], features: [] };
  }
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
}

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FREE: Sparkles,
  BASIC: Bot,
  PRO: BarChart3,
  BUSINESS: Coins,
};

export default async function PricingPage() {
  const { plans, features } = await getPlans();

  return (
    <main className="min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/beaver-mark.png" alt="" width={38} height={38} className="rounded-xl" priority />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1.5">
            <PricingActions />
          </nav>
        </div>
      </header>

      {/* Intro */}
      <section className="mx-auto max-w-6xl px-6 pt-16 text-center sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Pricing</p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Fair plans for shops of every size.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
          Start free and get every feature for 14 days. No surprises — upgrade only when you
          grow into it.
        </p>
      </section>

      {plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const Icon = TIER_ICONS[plan.key] ?? Sparkles;
              return (
                <div
                  key={plan.key}
                  className="flex flex-col rounded-2xl border border-hairline p-6"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-lg font-semibold tracking-tight text-slate-900">
                      {plan.name}
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-relaxed text-slate-500">{plan.tagline}</p>

                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-slate-900">
                      {fmt(plan.priceMonthly, plan.currency)}
                    </span>
                    <span className="text-sm text-slate-400">/mo</span>
                  </p>

                  {plan.productLimit !== null ? (
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      Up to {plan.productLimit} products
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-slate-400">Unlimited products</p>
                  )}

                  <ul className="mt-6 flex-1 space-y-3">
                    <ListItem checked>Point of sale, stock &amp; customers</ListItem>
                    {features.map((f) => (
                      <ListItem key={f.key} checked={plan.features.includes(f.key)}>
                        {f.label}
                      </ListItem>
                    ))}
                  </ul>

                  <PlanCta
                    planKey={plan.key}
                    planName={plan.name}
                    featured={!!plan.highlighted}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trial note */}
      <section className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-14 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Your first 14 days on every plan.</h2>
            <p className="mt-2 text-slate-500">
              Try AI and financial reports free at signup — no card required.
            </p>
          </div>
          <TrialCta />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-400 sm:flex-row">
          <span className="flex items-center gap-2">
            <Image src="/beaver-mark.png" alt="" width={22} height={22} className="rounded-md" />
            © {new Date().getFullYear()} Beaver
          </span>
          <span>Billing is manual for now — just tell us you want to upgrade.</span>
          <span className="flex items-center gap-4">
            <Link href="/terms" className="transition-colors hover:text-slate-600">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-slate-600">Privacy</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

function ListItem({
  checked,
  children,
}: {
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          checked ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'
        }`}
      >
        <Check className="size-3.5" />
      </span>
      <span className={checked ? 'text-slate-700' : 'text-slate-400'}>{children}</span>
    </li>
  );
}
