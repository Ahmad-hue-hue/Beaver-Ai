import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared workspace package ships TypeScript source; let Next transpile it.
  transpilePackages: ['@beaver/shared'],
  experimental: {
    // Keep server actions/body limits sane for POS payloads.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;
