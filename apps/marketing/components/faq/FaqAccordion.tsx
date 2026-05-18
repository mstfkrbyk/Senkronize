'use client';

import type { ReactElement } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  questions: FaqQuestion[];
}

export function FaqAccordion({ items }: { items: FaqCategory[] }): ReactElement {
  return (
    <div className="space-y-12">
      {items.map((section) => (
        <section key={section.category}>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {section.category}
          </h2>
          <Accordion type="single" collapsible className="mt-4 w-full">
            {section.questions.map((item, idx) => (
              <AccordionItem
                key={`${section.category}-${idx}`}
                value={`${section.category}-${idx}`}
              >
                <AccordionTrigger className="text-left text-base">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
