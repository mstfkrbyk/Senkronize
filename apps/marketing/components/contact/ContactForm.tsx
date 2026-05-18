'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

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

export function ContactForm(): ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        setError(body.message ?? 'Gönderilemedi. Lütfen tekrar deneyin.');
        return;
      }
      setDone(true);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Teşekkürler</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Mesajınız bize ulaştı. En kısa sürede dönüş yapacağız.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/contact">Yeni mesaj</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">Bize yazın</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Formu doldurun veya doğrudan{' '}
        <a href="mailto:hello@senkronize.com" className="font-medium text-primary">
          hello@senkronize.com
        </a>{' '}
        adresine e-posta gönderin.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
        <div>
          <FieldLabel htmlFor="contact-name">Ad</FieldLabel>
          <input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            maxLength={120}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={name}
            onChange={(ev) => {
              setName(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="contact-email">E-posta</FieldLabel>
          <input
            id="contact-email"
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
          <FieldLabel htmlFor="contact-subject">Konu</FieldLabel>
          <input
            id="contact-subject"
            name="subject"
            required
            maxLength={200}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={subject}
            onChange={(ev) => {
              setSubject(ev.target.value);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="contact-message">Mesaj</FieldLabel>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={5}
            maxLength={8000}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? 'Gönderiliyor…' : 'Gönder'}
        </Button>
      </form>
    </div>
  );
}
