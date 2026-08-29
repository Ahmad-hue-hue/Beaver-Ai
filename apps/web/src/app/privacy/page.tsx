import { LegalHeader, LegalFooter } from '@/components/legal-shell';

const sections: { title: string; body: string }[] = [
  {
    title: '1. Overview',
    body:
      'This Privacy Policy explains what information Beaver collects, how we use it, and the choices you have. ' +
      'It applies to everyone who uses the Beaver platform, whether you are a business owner, a staff member, ' +
      'or a visitor to our website.',
  },
  {
    title: '2. What we collect',
    body:
      'When you register we collect your name, email address and, optionally, phone number. For your business we ' +
      'collect the details you enter to run it — products, prices, stock, suppliers, customers, sales, purchases, ' +
      'expenses and related records. We may also collect basic technical data such as IP address and browser type ' +
      'to secure and operate the service.',
  },
  {
    title: '3. How we use it',
    body:
      'We use your information to provide and maintain the service, to keep your accounts secure, to calculate ' +
      'analytics and reports that you request, and to contact you about your account or plan. We do not sell your ' +
      'personal information, and we do not use your business data to advertise to your customers.',
  },
  {
    title: '4. The AI assistant',
    body:
      'The optional AI assistant processes the business context you share within your workspace to generate ' +
      'responses and insights for you. This processing happens to serve your request and is not used to train ' +
      'models that are shared with other tenants, and is not sold to third parties.',
  },
  {
    title: '5. Sharing',
    body:
      'We share information only where needed to provide the service (for example hosting and infrastructure ' +
      'providers storing data on our behalf), where you direct us, or where required by law. Any provider we use ' +
      'is bound to keep your data confidential.',
  },
  {
    title: '6. How long we keep it',
    body:
      'We keep your data while your account is active so the service and your records remain available, and for a ' +
      'reasonable period after you stop using the service to allow for data export and obligations. You may request ' +
      'deletion of your account and data at any time.',
  },
  {
    title: '7. Your choices and rights',
    body:
      'As a workspace administrator you can manage users and roles. You may request a copy of your data, ask us to ' +
      'correct inaccuracies, or request deletion by contacting us. We will respond within a reasonable period.',
  },
  {
    title: '8. Security',
    body:
      'We apply appropriate technical and organisational measures to protect your data, including encryption in ' +
      'transit, secure storage, and access controls. No system is completely secure, and we cannot guarantee ' +
      'absolute security.',
  },
  {
    title: '9. Children',
    body:
      'The service is intended for business use by adults. We do not knowingly collect personal information from ' +
      'children.',
  },
  {
    title: '10. Changes to this policy',
    body:
      'We may update this policy from time to time. Material changes will be posted here and, where appropriate, ' +
      'notified to you. Continued use of the service after changes take effect means you accept the updated policy.',
  },
  {
    title: '11. Contact',
    body:
      'For any privacy questions or requests, contact our data protection contact at privacy@beaver.example. We ' +
      'are based in Dar es Salaam, Tanzania.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-canvas">
      <LegalHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Privacy Policy</h1>
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
          Questions about this policy? Reach out at{' '}
          <a href="mailto:privacy@beaver.example" className="text-brand-700 hover:text-brand-800">
            privacy@beaver.example
          </a>
          .
        </div>
      </div>

      <LegalFooter />
    </main>
  );
}
