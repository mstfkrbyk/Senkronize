'use client';

import type { ReactElement } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { JsonLd } from '@/components/seo/JsonLd';
import { HOME_FAQ_ITEMS } from '@/lib/home-faq-data';

const faqPageLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

export function HomeFaqSection(): ReactElement {
  return (
    <section className="bg-white py-16 sm:py-24">
      <JsonLd data={faqPageLd} />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sık sorulan sorular
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Senkronize hakkında merak edilenler
        </p>
        <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <Accordion type="single" collapsible className="w-full">
            {HOME_FAQ_ITEMS.map((item, idx) => (
              <AccordionItem key={item.q} value={`home-faq-${idx}`}>
                <AccordionTrigger className="text-left text-base">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
