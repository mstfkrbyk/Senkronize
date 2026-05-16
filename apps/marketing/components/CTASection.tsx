'use client';

import { motion } from 'framer-motion';
import type { ReactElement } from 'react';

import { getPanelUrl } from '@/lib/panel-url';
import { Button } from '@/components/ui/button';

export function CTASection(): ReactElement {
  const panel = getPanelUrl();

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <motion.h2
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          Bugün Başlayın
        </motion.h2>
        <motion.p
          className="mt-4 text-lg text-indigo-100"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          14 gün ücretsiz, kredi kartı gerekmez.
        </motion.p>
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Button
            size="lg"
            className="h-14 bg-white px-10 text-base font-semibold text-indigo-700 shadow-lg hover:bg-indigo-50"
            asChild
          >
            <a href={`${panel}/register`}>Ücretsiz Hesap Oluştur</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
