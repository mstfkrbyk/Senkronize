'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { ReactElement } from 'react';

import { getPanelUrl } from '@/lib/panel-url';
import { Button } from '@/components/ui/button';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroSection(): ReactElement {
  const panel = getPanelUrl();

  return (
    <section className="relative overflow-hidden bg-white pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,70,229,0.15),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.1 } },
              }}
            >
              <motion.h1 className="text-4xl font-extrabold tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                <motion.span className="block" variants={fadeUp}>
                  Tüm Pazaryerlerinizi
                </motion.span>
                <motion.span
                  className="mt-1 block text-primary"
                  variants={fadeUp}
                >
                  Tek Panelden Yönetin
                </motion.span>
              </motion.h1>
            </motion.div>
            <motion.p
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              Trendyol, Hepsiburada, N11 ve daha fazlası — gerçek zamanlı stok,
              fiyat ve sipariş yönetimi.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <a href={`${panel}/register`}>Ücretsiz Deneyin</a>
              </Button>
              <Button size="lg" variant="ghost" className="h-12 gap-2" asChild>
                <Link href="#demo">
                  <Play className="h-5 w-5 fill-current" />
                  Demo İzle
                </Link>
              </Button>
            </motion.div>
            <motion.div
              className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-8 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <span>
                <strong className="text-foreground">10+</strong> pazaryeri &
                ERP entegrasyonu
              </span>
              <span>
                <strong className="text-foreground">Webhook</strong> ile anlık
                senkron
              </span>
              <span>
                <strong className="text-foreground">14 gün</strong> ücretsiz
                deneme
              </span>
            </motion.div>
          </div>

          <motion.div
            className="relative lg:justify-self-end"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            id="demo"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-100 via-white to-violet-100 shadow-xl ring-1 ring-black/5">
              <div className="flex h-9 items-center gap-1.5 border-b border-border/80 bg-white/80 px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                <span className="ml-2 flex-1 truncate rounded bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground">
                  app.senkronize.com/dashboard
                </span>
              </div>
              <div className="aspect-[4/3] p-4 sm:p-6">
                <div className="grid h-full grid-cols-3 gap-3">
                  <div className="col-span-1 rounded-lg bg-white/90 p-3 shadow-sm ring-1 ring-indigo-100">
                    <div className="h-2 w-12 rounded bg-indigo-200" />
                    <div className="mt-3 space-y-2">
                      <div className="h-1.5 w-full rounded bg-slate-100" />
                      <div className="h-1.5 w-[80%] rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-3">
                    <div className="h-24 rounded-lg bg-gradient-to-r from-indigo-500/20 to-violet-500/20 p-3 ring-1 ring-indigo-200/50">
                      <div className="h-2 w-24 rounded bg-indigo-300/80" />
                      <div className="mt-4 flex gap-2">
                        <div className="h-8 flex-1 rounded-md bg-white/80" />
                        <div className="h-8 flex-1 rounded-md bg-white/60" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-20 rounded-lg bg-white/90 shadow-sm ring-1 ring-slate-100" />
                      <div className="h-20 rounded-lg bg-white/90 shadow-sm ring-1 ring-slate-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
