import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { StatusDashboard } from '@/app/status/status-dashboard';

export const metadata: Metadata = {
  title: 'Sistem Durumu',
  description:
    'Senkronize API ve bağlı servislerin anlık durumu. Sağlık uç noktasından canlı veri.',
  openGraph: {
    title: 'Sistem Durumu | Senkronize',
    description:
      'API, veritabanı ve diğer bileşenlerin çalışma durumu özeti.',
    url: '/status',
    locale: 'tr_TR',
    type: 'website',
  },
};

export default function StatusPage(): ReactElement {
  return (
    <main>
      <section className="border-b border-border bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Sistem durumu
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Üretim API sağlık uç noktasından gelen veriler ve planlanan izleme
            metrikleri için özet ekran.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <StatusDashboard />
      </section>
    </main>
  );
}
