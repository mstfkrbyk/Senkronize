'use client';

import { useEffect, useState, type ReactElement } from 'react';

/** Sabit beta bitiş tarihi — yaklaşık 30 gün (build zamanından bağımsız gösterim) */
const BETA_END = new Date('2026-06-19T00:00:00+03:00');

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdown(target: Date): CountdownParts {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function CountdownUnit({ value, label }: { value: number; label: string }): ReactElement {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-white/10 px-3 py-4 backdrop-blur sm:min-w-[5.5rem] sm:px-4">
      <span className="text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-xs font-medium uppercase tracking-wide text-indigo-100">
        {label}
      </span>
    </div>
  );
}

export function BetaCountdownSection(): ReactElement {
  const [parts, setParts] = useState<CountdownParts>(() => getCountdown(BETA_END));

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(getCountdown(BETA_END));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="bg-gradient-to-r from-indigo-600 to-violet-600 py-14 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
          Beta erişimi
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          Beta erişimi başlıyor
        </h2>
        <p className="mt-3 text-indigo-100">
          Erken erişim kontenjanı sınırlı — geri sayımı takip edin.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-4">
          <CountdownUnit value={parts.days} label="Gün" />
          <CountdownUnit value={parts.hours} label="Saat" />
          <CountdownUnit value={parts.minutes} label="Dakika" />
          <CountdownUnit value={parts.seconds} label="Saniye" />
        </div>
      </div>
    </section>
  );
}
