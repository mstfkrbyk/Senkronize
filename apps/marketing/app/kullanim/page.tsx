import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  robots: { index: false, follow: false },
};

export default function TermsPage(): ReactElement {
  return (
    <main className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#111827]">Kullanım Koşulları</h1>
        <p className="mt-6 text-muted-foreground">
          Güncel kullanım koşulları için{' '}
          <Link
            href="/legal/terms"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Kullanım Koşulları
          </Link>{' '}
          sayfasına gidin.
        </p>
      </div>
    </main>
  );
}
