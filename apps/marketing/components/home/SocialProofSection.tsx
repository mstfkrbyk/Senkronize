import type { ReactElement } from 'react';

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
];

export function SocialProofSection(): ReactElement {
  return (
    <section className="border-y border-border bg-white py-10 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:gap-8 sm:px-6 lg:px-8">
        <div className="flex -space-x-3" aria-hidden>
          {AVATAR_COLORS.map((color, i) => (
            <div
              key={color}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white ring-1 ring-border ${color}`}
              title={`Satıcı ${i + 1}`}
            >
              {String.fromCharCode(65 + (i % 26))}
            </div>
          ))}
        </div>
        <p className="text-center text-base font-medium text-foreground sm:text-lg">
          <span className="font-bold text-primary">500+</span> satıcı Senkronize&apos;a
          güveniyor
        </p>
      </div>
    </section>
  );
}
