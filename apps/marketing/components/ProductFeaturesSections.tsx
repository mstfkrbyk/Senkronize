'use client';

import { motion } from 'framer-motion';
import type { ReactElement } from 'react';

import { FEATURE_PAGE_SECTIONS } from '@/lib/site-content';

export function ProductFeaturesSections(): ReactElement {
  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6 lg:space-y-28 lg:px-8">
        {FEATURE_PAGE_SECTIONS.map((section, index) => {
          const Icon = section.icon;
          const reverse = index % 2 === 1;
          return (
            <motion.article
              key={section.title}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <div className={reverse ? 'lg:order-2' : 'lg:order-1'}>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-7 w-7" aria-hidden />
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                  {section.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {section.description}
                </p>
              </div>
              <div
                className={`relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-primary/25 bg-gradient-to-br from-white to-indigo-50/80 p-8 shadow-inner ring-1 ring-black/5 ${
                  reverse ? 'lg:order-1' : 'lg:order-2'
                }`}
                aria-hidden
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(79,70,229,0.12),transparent_55%)]" />
                <div className="relative flex flex-col items-center gap-3 text-center text-sm font-medium text-muted-foreground">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/90 shadow-md ring-1 ring-indigo-100">
                    <Icon className="h-12 w-12 text-primary/70" />
                  </div>
                  <span className="text-xs uppercase tracking-wide text-primary/80">
                    Panel görseli hazırlanıyor
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
