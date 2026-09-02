import { LegalHeader, LegalFooter } from '@/components/legal-shell';

const sections: { title: string; body: string }[] = [
  {
    title: '1. Acceptance of these terms',
    body:
      'By creating an account or using the Beaver platform, you agree to these Terms of Service and our ' +
      'Privacy Policy. If you are registering on behalf of a business, you confirm you are authorised to ' +
      'bind that business to these terms.',
  },
  {
    title: '2. Your account',
    body:
      'You are responsible for the activity on your account and for keeping your login details secure. ' +
      'You must provide accurate information when you register. A business administrator may manage users ' +
      'and roles within a workspace; each user acts under the authority of that workspace owner.',
  },
  {
    title: '3. The service',
    body:
      'Beaver provides point-of-sale, inventory, purchasing, sales, analytics, reporting and an optional AI ' +
      'assistant for retail businesses. Access is by subscription as described below, arranged directly with us.',
  },
  {
    title: '4. Subscription and billing',
    body:
      'Beaver is provided on a per-account monthly subscription of 50,000 TZS. New accounts are approved by us ' +
      'before they can sign in. Each approved account is granted 30 days of access; at the end of the month the ' +
      'account pauses and must be renewed by payment arranged directly with us. There is no auto-renewal and no ' +
      'automatic charge. You may stop using Beaver at any time.',
  },
  {
    title: '5. Acceptable use',
    body:
      'You agree not to misuse the service, attempt to break its security, interfere with other tenants, or use ' +
      'it to store or process content that is unlawful, deceptive, or infringes the rights of others.',
  },
  {
    title: '6. Your data',
    body:
      'You retain all rights to the business data you enter into Beaver. We process that data only to provide ' +
      'the service to you, and handle it as described in our Privacy Policy. Your transactional and financial ' +
      'records are yours; export and deletion are available on request.',
  },
  {
    title: '7. The AI assistant',
    body:
      'Our optional AI assistant and insights are provided "as is" and are intended to assist, not replace, your ' +
      'own judgement. You are responsible for reviewing anything you act upon. AI outputs may occasionally be ' +
      'inaccurate; check important figures before relying on them.',
  },
  {
    title: '8. Availability and support',
    body:
      'We aim to keep the service available and reliable, but we do not guarantee uninterrupted or error-free ' +
      'operation, particularly during scheduled maintenance or events outside our control.',
  },
  {
    title: '9. Limitation of liability',
    body:
      'To the maximum extent permitted by law, Beaver and its operators are not liable for indirect, incidental, ' +
      'special, or consequential damages, or for loss of profits, data, or goodwill, arising from your use of the ' +
      'service. Our total liability is limited to the amount you paid for the service in the twelve months before ' +
      'the claim.',
  },
  {
    title: '10. Termination',
    body:
      'You may stop using Beaver at any time. We may suspend or terminate access for violation of these terms, ' +
      'sustained non-payment, or activity that threatens the platform. On termination you remain responsible for ' +
      'amounts due, and may export your data during the wind-down.',
  },
  {
    title: '11. Changes to these terms',
    body:
      'We may update these terms from time to time. We will post any changes here and, where the change is ' +
      'material, notify you. Continued use after changes take effect means you accept the updated terms.',
  },
  {
    title: '12. Governing law',
    body:
      'These terms are governed by the laws of the United Republic of Tanzania. Any disputes will be resolved in ' +
      'the courts of Dar es Salaam, Tanzania.',
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-canvas">
      <LegalHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated 29 August 2026</p>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-hairline pt-6 text-sm text-slate-400">
          Questions about these terms? Reach out at{' '}
          <a href="mailto:legal@beaver.example" className="text-brand-700 hover:text-brand-800">
            legal@beaver.example
          </a>
          .
        </div>
      </div>

      <LegalFooter />
    </main>
  );
}
