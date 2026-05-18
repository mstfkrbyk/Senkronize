'use client';

import * as Sentry from '@sentry/nextjs';
import type { ReactElement } from 'react';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props): ReactElement {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="tr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
        <h2 className="text-xl font-semibold">Bir şeyler yanlış gitti</h2>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
          onClick={() => {
            reset();
          }}
        >
          Tekrar dene
        </button>
      </body>
    </html>
  );
}
