'use client';

import type { ReactElement } from 'react';

import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';

export function PricingEarlyAccess(): ReactElement {
  return (
    <section className="border-t border-border bg-gradient-to-br from-indigo-50 via-white to-violet-50 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          Fiyatlar yakında açıklanacak
        </h2>
        <p className="mt-4 text-muted-foreground">
          Erken kayıt listesine katılın; resmi fiyatlar ve lansman tarihi size önce
          iletilsin.
        </p>
        <div className="mt-8 text-left">
          <NewsletterSubscribe variant="pricing" />
        </div>
      </div>
    </section>
  );
}
