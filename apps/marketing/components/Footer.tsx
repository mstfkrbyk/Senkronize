import Link from 'next/link';
import type { ReactElement } from 'react';

import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';

const footerColumns: {
  title: string;
  links: { href: string; label: string }[];
}[] = [
  {
    title: 'Ürün',
    links: [
      { href: '/features', label: 'Özellikler' },
      { href: '/pricing', label: 'Fiyatlandırma' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Şirket',
    links: [
      { href: '#', label: 'Hakkımızda' },
      { href: '#', label: 'Kariyer' },
      { href: '/faq', label: 'SSS' },
      { href: '/contact', label: 'İletişim' },
    ],
  },
  {
    title: 'Destek',
    links: [
      { href: '/faq', label: 'Yardım Merkezi' },
      { href: '/status', label: 'Durum Sayfası' },
      { href: '/docs', label: 'API Dokümantasyonu' },
      { href: '/changelog', label: 'Sürüm Notları' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { href: '/legal/privacy', label: 'Gizlilik Politikası' },
      { href: '/legal/terms', label: 'Kullanım Koşulları' },
      { href: '/legal/cancellation', label: 'İptal ve İade' },
      { href: 'mailto:kvkk@senkronize.com', label: 'KVKK Başvuru Formu' },
    ],
  },
];

export function Footer(): ReactElement {
  return (
    <footer className="border-t border-border bg-[#F9FAFB]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-primary"
            >
              Senkronize
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Pazaryeri ve ERP entegrasyonunda tek panel, gerçek zamanlı senkron.
            </p>
            <div className="mt-8 max-w-sm">
              <NewsletterSubscribe variant="footer" />
            </div>
            <div className="mt-6 flex gap-3">
              <a
                href="https://twitter.com"
                className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-primary"
                aria-label="X (Twitter)"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-primary"
                aria-label="LinkedIn"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-primary"
                aria-label="YouTube"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('mailto:') ||
                    link.href.startsWith('http://') ||
                    link.href.startsWith('https://') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground sm:text-left">
          © 2026 Senkronize. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}
