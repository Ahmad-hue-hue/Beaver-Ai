import path from 'node:path';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// The PWA talks to the API from the browser. Same-origin in the single-host
// deploy (reverse proxy routes /api/* to the API), but allow the configured
// origin explicitly so standalone API hosts keep working.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// SRI hash-based CSP (experimental.sri): keeps static generation + CDN caching
// while still enabling a strict policy with no 'unsafe-inline' for scripts.
const cspHeader = `
  default-src 'self';
  script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self' https://api.fontshare.com;
  connect-src 'self' ${apiOrigin};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspHeader },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared workspace package ships TypeScript source; let Next transpile it.
  transpilePackages: ['@beaver/shared'],
  // Slim, self-contained production output for the Docker image.
  output: 'standalone',
  // Trace files from the monorepo root so the standalone bundle keeps workspace deps.
  outputFileTracingRoot: path.join(__dirname, '../../..'),
  experimental: {
    // Keep server actions/body limits sane for POS payloads.
    serverActions: { bodySizeLimit: '2mb' },
    // Hash-based integrity attributes so a strict CSP needs no 'unsafe-inline'
    // for scripts while pages stay statically renderable.
    sri: { algorithm: 'sha256' },
  },
  async headers() {
    return [
      {
        // Security headers on all navigations (skip static chunks/paths handled below).
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Immutable hashed build assets — long-lived browser + CDN cache.
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },
};

export default nextConfig;