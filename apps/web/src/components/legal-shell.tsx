import Link from 'next/link';
import Image from 'next/image';
import { BrandMark } from '@/components/brand-mark';

export function LegalHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={38} />
          <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1.5">
          <Link
            href="/register"
            className="whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-slate-400 sm:flex-row">
        <span className="flex items-center gap-2">
          <Image src="/beaver-mark.png" alt="" width={22} height={22} className="rounded-md" />
          © {new Date().getFullYear()} Beaver
        </span>
        <span className="flex items-center gap-4">
          <Link href="/terms" className="transition-colors hover:text-slate-600">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-slate-600">
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}
