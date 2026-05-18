import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';

import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { AnalyticsProvider } from '@/app/providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://senkronize.com'),
  title: {
    default: 'Senkronize — Tüm Pazaryerlerinizi Tek Panelden Yönetin',
    template: '%s | Senkronize',
  },
  description:
    'Trendyol, Hepsiburada, N11, Amazon ve 50+ platform için akıllı e-ticaret entegrasyon platformu. ERP entegrasyonu, otomatik fiyatlandırma ve BuyBox optimizasyonu.',
  keywords: [
    'e-ticaret entegrasyon',
    'trendyol entegrasyon',
    'hepsiburada entegrasyon',
    'pazaryeri yönetimi',
    'ERP entegrasyon',
    'multi channel e-ticaret',
  ],
  authors: [{ name: 'Senkronize' }],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://senkronize.com',
    siteName: 'Senkronize',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@senkronize' },
  robots: { index: true, follow: true },
  verification: { google: 'placeholder-google-verification' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html lang="tr" className={inter.variable}>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AnalyticsProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
