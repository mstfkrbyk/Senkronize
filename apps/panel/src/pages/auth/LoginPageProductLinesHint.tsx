import type { ReactElement } from 'react';

import { PRODUCT_SELECTION_OPTIONS } from '@/lib/product-selection';

/** Giriş kartının altında — demo modu kapalıyken ürün hatları özeti. */
export function LoginPageProductLinesHint(): ReactElement {
  return (
    <aside
      className="mx-auto mt-6 w-full max-w-md text-center"
      aria-label="Ürün hatları"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ürün hatları
      </p>
      <ul className="mt-2 space-y-2">
        {PRODUCT_SELECTION_OPTIONS.map((option) => (
          <li key={option.id}>
            <span className="text-sm font-medium text-foreground">{option.title}</span>
            <span className="text-sm text-muted-foreground"> — {option.description}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Yerel geliştirmede örnek hesaplar için kök{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          .env
        </code>{' '}
        dosyasında{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          VITE_DEMO_MODE=true
        </code>{' '}
        ve{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          SEED_DEMO=true
        </code>{' '}
        kullanın; ayrıntılar{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          .env.example
        </code>{' '}
        içinde.
      </p>
    </aside>
  );
}
