'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';

type MarketplaceCount = '1' | '2-5' | '5+';

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: string;
}): ReactElement {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-foreground"
    >
      {children}
    </label>
  );
}

export default function DemoPage(): ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [marketplaceCount, setMarketplaceCount] =
    useState<MarketplaceCount>('1');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          phone,
          marketplaceCount,
          message,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        setError(body.message ?? 'Gönderilemedi. Lütfen tekrar deneyin.');
        return;
      }
      track('demo_requested', { marketplaceCount });
      setDone(true);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 md:py-24">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Teşekkürler
        </h1>
        <p className="mt-4 text-muted-foreground">
          Demo talebiniz alındı. Ekibimiz en kısa sürede sizinle iletişime
          geçecek.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 md:py-24">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Demo talep formu
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bilgilerinizi bırakın; size uygun zaman için geri dönelim.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <FieldLabel htmlFor="demo-name">İsim</FieldLabel>
          <input
            id="demo-name"
            name="name"
            required
            autoComplete="name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={name}
            onChange={(ev) => {
              setName(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-email">E-posta</FieldLabel>
          <input
            id="demo-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-company">Şirket</FieldLabel>
          <input
            id="demo-company"
            name="company"
            required
            autoComplete="organization"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={company}
            onChange={(ev) => {
              setCompany(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-phone">Telefon</FieldLabel>
          <input
            id="demo-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={phone}
            onChange={(ev) => {
              setPhone(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-mp">
            Kaç pazaryerinde satış yapıyorsunuz?
          </FieldLabel>
          <select
            id="demo-mp"
            name="marketplaceCount"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={marketplaceCount}
            onChange={(ev) => {
              setMarketplaceCount(ev.target.value as MarketplaceCount);
            }}
          >
            <option value="1">1</option>
            <option value="2-5">2–5</option>
            <option value="5+">5+</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="demo-message">Mesaj</FieldLabel>
          <textarea
            id="demo-message"
            name="message"
            rows={4}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={message}
            onChange={(ev) => {
              setMessage(ev.target.value);
            }}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Gönderiliyor…' : 'Gönder'}
        </Button>
      </form>
    </main>
  );
}
