'use client';

import type { ReactElement } from 'react';

import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';
import { PRICING_PAGE_COPY } from '@/lib/site-content';

export function PricingEarlyAccess(): ReactElement {
  return (
    <section
      id="erken-erisim"
      className="border-t border-border bg-gradient-to-br from-indigo-50 via-white to-violet-50 py-16 sm:py-20 scroll-mt-20"
    >
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          {PRICING_PAGE_COPY.earlyAccessTitle}
        </h2>
        <p className="mt-4 text-muted-foreground">{PRICING_PAGE_COPY.earlyAccessBody}</p>
        <div className="mt-8 text-left">
          <NewsletterSubscribe variant="pricing" />
        </div>
      </div>
    </section>
  );
}
