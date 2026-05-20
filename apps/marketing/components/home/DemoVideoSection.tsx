'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Play, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';

/** Lansman öncesi demo — YouTube veya Loom embed URL */
const DEMO_VIDEO_EMBED_URL =
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ??
  'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1';

export function DemoVideoSection(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
            Ürünü 2 dakikada görün
          </h2>
          <p className="mt-3 text-muted-foreground">
            Panel, senkronizasyon ve BuyBox akışını kısa bir demo ile keşfedin.
          </p>
        </div>
        <div className="relative mt-10 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-100 via-white to-violet-100 shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            className="group relative block w-full aspect-video"
            onClick={() => setOpen(true)}
            aria-label="Demo videosunu izle"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/5 transition group-hover:bg-black/10">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-105">
                <Play className="h-8 w-8 fill-current pl-1" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-foreground">Demo İzle</span>
            </div>
            <div className="pointer-events-none flex h-full items-center justify-center p-8 opacity-40">
              <div className="grid w-full max-w-md grid-cols-3 gap-2">
                <div className="col-span-1 h-24 rounded-lg bg-white/80" />
                <div className="col-span-2 h-24 rounded-lg bg-indigo-200/60" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-black shadow-2xl">
            <Dialog.Title className="sr-only">Senkronize ürün demosu</Dialog.Title>
            <div className="relative aspect-video w-full">
              <iframe
                title="Senkronize demo videosu"
                src={open ? DEMO_VIDEO_EMBED_URL : undefined}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-3 top-3 rounded-md bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
