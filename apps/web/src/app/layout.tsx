import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Beaver — Business OS',
  description: 'AI-powered business management for small and medium shops.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Beaver',
  appleWebApp: { capable: true, title: 'Beaver', statusBarStyle: 'default' },
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
