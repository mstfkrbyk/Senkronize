import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  /** Hazırlık: `messages/tr.json` + `messages/en.json`. Next 15 App Router + `i18n` burada: `localeDetection` yalnızca `false` ile tip güvenli. */
  i18n: {
    locales: ['tr', 'en'],
    defaultLocale: 'tr',
    localeDetection: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.senkronize.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.senkronize.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: '/og-image.png', destination: '/opengraph-image' }];
  },
};

export default withSentryConfig(nextConfig, { silent: true });
