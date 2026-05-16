'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { Menu } from 'lucide-react';

import { getPanelUrl } from '@/lib/panel-url';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const navLinks = [
  { href: '/features', label: 'Özellikler' },
  { href: '/pricing', label: 'Fiyatlandırma' },
  { href: '/blog', label: 'Blog' },
] as const;

export function Navbar(): ReactElement {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = getPanelUrl();

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-md'
          : 'border-b border-transparent bg-background/95'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-primary"
        >
          Senkronize
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <a href={`${panel}/login`}>Giriş Yap</a>
          </Button>
          <Button asChild>
            <a href={`${panel}/register`}>Ücretsiz Dene</a>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menüyü aç">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw,320px)]">
              <SheetHeader>
                <SheetTitle className="text-left text-primary">
                  Menü
                </SheetTitle>
              </SheetHeader>
              <div className="mt-8 flex flex-col gap-4">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-lg font-medium text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <hr className="my-2 border-border" />
                <Button variant="outline" asChild className="w-full">
                  <a href={`${panel}/login`}>Giriş Yap</a>
                </Button>
                <Button asChild className="w-full">
                  <a href={`${panel}/register`}>Ücretsiz Dene</a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
