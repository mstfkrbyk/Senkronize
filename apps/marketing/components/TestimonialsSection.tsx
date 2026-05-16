'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { ReactElement } from 'react';

import { TESTIMONIALS } from '@/lib/site-content';
import { Card, CardContent } from '@/components/ui/card';

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function TestimonialsSection(): ReactElement {
  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Müşterilerimiz Ne Diyor?
          </h2>
          <p className="mt-4 text-muted-foreground">
            E-ticaret ekiplerinin Senkronize ile deneyimleri.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <Card className="h-full border-border bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 text-amber-400" aria-label="5 üzerinden 5 yıldız">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" aria-hidden />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white"
                      aria-hidden
                    >
                      {initials(t.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.title}, {t.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
