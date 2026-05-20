'use client';

import { useCallback, useState, type FormEvent, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';

export type NewsletterSubscribeVariant = 'footer' | 'exit' | 'pricing';

export interface NewsletterSubscribeProps {
  variant: NewsletterSubscribeVariant;
}

export function NewsletterSubscribe({
  variant,
}: NewsletterSubscribeProps): ReactElement {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      setStatus('loading');
      setMessage(null);
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data: unknown = await res.json().catch(() => null);
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'message' in data &&
          typeof (data as { message: unknown }).message === 'string'
            ? (data as { message: string }).message
            : 'Bir sorun oluştu.';
        const ok =
          typeof data === 'object' &&
          data !== null &&
          'ok' in data &&
          (data as { ok: unknown }).ok === true;
        if (res.ok && ok) {
          setStatus('success');
          setMessage(msg);
          setEmail('');
        } else {
          setStatus('error');
          setMessage(msg);
        }
      } catch {
        setStatus('error');
        setMessage('Ağ hatası. Lütfen tekrar deneyin.');
      }
    },
    [email],
  );

  const isFooter = variant === 'footer';
  const isPricing = variant === 'pricing';

  return (
    <div
      className={
        isFooter
          ? 'rounded-xl border border-border bg-card p-5 shadow-sm'
          : isPricing
            ? 'rounded-xl border border-border bg-card p-6 shadow-sm'
            : 'space-y-3'
      }
    >
      {isFooter ? (
        <>
          <h3 className="text-sm font-semibold text-foreground">
            Bültenimize abone olun
          </h3>
          <p className="text-xs text-muted-foreground">
            E-ticaret entegrasyonu, BuyBox ve operasyon ipuçları doğrudan gelen kutunuza.
          </p>
        </>
      ) : null}
      {isPricing ? (
        <p className="mb-4 text-sm text-muted-foreground">
          E-posta adresinizi bırakın; fiyatlar açıklandığında ilk siz haberdar olun.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`newsletter-email-${variant}`}>
          E-posta
        </label>
        <input
          id={`newsletter-email-${variant}`}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="ornek@sirketiniz.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <Button type="submit" disabled={status === 'loading'} className="shrink-0">
          {status === 'loading'
            ? 'Gönderiliyor…'
            : isPricing
              ? 'Listeye Katıl'
              : 'Kaydol'}
        </Button>
      </form>
      {message ? (
        <p
          className={
            status === 'success'
              ? 'text-xs font-medium text-emerald-600'
              : 'text-xs font-medium text-destructive'
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
