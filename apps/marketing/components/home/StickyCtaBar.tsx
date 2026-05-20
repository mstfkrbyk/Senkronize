'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { getPanelUrl } from '@/lib/panel-url';

const SCROLL_THRESHOLD = 400;

export function StickyCtaBar(): ReactElement {
  const [visible, setVisible] = useState(false);
  const panel = getPanelUrl();

  useEffect(() => {
    const onScroll = (): void => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="region"
      aria-label="Hızlı kayıt"
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="hidden text-sm font-medium text-foreground sm:block">
          14 gün ücretsiz deneme — kredi kartı gerekmez
        </p>
        <Button size="lg" className="ml-auto shrink-0" asChild>
          <a
            href={`${panel}/register`}
            onClick={() => {
              track('cta_clicked', { location: 'sticky_bar', plan: 'trial' });
            }}
          >
            Ücretsiz Dene
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
          <Link href="/pricing">Fiyatlar</Link>
        </Button>
      </div>
    </div>
  );
}
