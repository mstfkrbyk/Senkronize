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
    default: 'Senkronize',
    template: '%s | Senkronize',
  },
  description: 'Pazaryeri ve ERP entegrasyon platformu',
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
