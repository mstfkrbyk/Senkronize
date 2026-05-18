'use client';

import { useEffect, useState, type ReactElement } from 'react';

import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const STORAGE_KEY = 'senkronize_exit_intent_newsletter_v1';

export function ExitIntentNewsletter(): ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onLeave = (e: MouseEvent): void => {
      if (e.clientY > 0) {
        return;
      }
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) {
          return;
        }
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        return;
      }
      setOpen(true);
    };

    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle>Ayrılmadan önce — 14 günlük ücretsiz denemeyi kaçırma</SheetTitle>
          <SheetDescription>
            Pazaryeri ve ERP senkronizasyonu hakkında güncel içerikler ve ürün haberleri
            için e-posta adresinizi bırakın.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <NewsletterSubscribe variant="exit" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
