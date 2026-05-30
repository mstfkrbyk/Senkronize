import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  robots: { index: false, follow: false },
};

export default function PrivacyPage(): ReactElement {
  return (
    <main className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#111827]">Gizlilik Politikası</h1>
        <p className="mt-6 text-muted-foreground">
          Güncel gizlilik politikası metni için{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Gizlilik Politikası
          </Link>{' '}
          sayfasına gidin.
        </p>
      </div>
    </main>
  );
}
