import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: 'Beaver — Business OS for Tanzanian shops',
    template: '%s · Beaver',
  },
  description:
    'Beaver is the AI-powered operating system for your shop — point of sale, stock and reorders, customers and debt, and an assistant that tells you what to do next. Free 14-day trial, no card required, English & Kiswahili.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Beaver',
  appleWebApp: { capable: true, title: 'Beaver', statusBarStyle: 'default' },
  openGraph: {
    title: 'Beaver — Business OS for Tanzanian shops',
    description:
      'Sell faster, track everything, know what’s next. Point of sale, stock, customers & debt, and AI insights — free 14-day trial, no card required.',
    url: '/',
    siteName: 'Beaver',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beaver — Business OS for Tanzanian shops',
    description:
      'Point of sale, stock, customers & debt, and AI insights — free 14-day trial, no card required.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#039855',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* General Sans (UI) + JetBrains Mono (receipts/IDs) — modern, non-generic. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=jetbrains-mono@400,500&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
