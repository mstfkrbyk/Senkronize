'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState, type ReactElement } from 'react';

interface StatItem {
  value: string;
  label: string;
  /** Numeric part to animate (omit for static display) */
  numericEnd?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

const STATS: StatItem[] = [
  {
    value: '50+',
    label: 'Entegre platform',
    numericEnd: 50,
    suffix: '+',
  },
  {
    value: '99.9%',
    label: 'Çalışma süresi',
    numericEnd: 99.9,
    suffix: '%',
    decimals: 1,
  },
  {
    value: '<30sn',
    label: 'Sync hızı',
  },
  {
    value: '14 Gün',
    label: 'Ücretsiz deneme',
  },
];

interface AnimatedStatProps {
  stat: StatItem;
}

function AnimatedStat({ stat }: AnimatedStatProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(() => {
    if (stat.numericEnd === undefined) {
      return stat.value;
    }
    const decimals = stat.decimals ?? 0;
    const zero = decimals > 0 ? (0).toFixed(decimals) : '0';
    return `${stat.prefix ?? ''}${zero}${stat.suffix ?? ''}`;
  });

  useEffect(() => {
    if (!inView || stat.numericEnd === undefined) {
      return;
    }
    const duration = 1600;
    const start = performance.now();
    const decimals = stat.decimals ?? 0;
    const end = stat.numericEnd;

    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const current = end * eased;
      const formatted =
        t >= 1
          ? decimals > 0
            ? end.toFixed(decimals)
            : Math.floor(end).toString()
          : decimals > 0
            ? current.toFixed(decimals)
            : Math.floor(current).toString();
      setDisplay(`${stat.prefix ?? ''}${formatted}${stat.suffix ?? ''}`);
      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, [inView, stat.numericEnd, stat.decimals, stat.prefix, stat.suffix]);

  if (stat.numericEnd === undefined) {
    return (
      <div ref={ref} className="text-center">
        <div className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          {stat.value}
        </div>
        <div className="mt-2 text-sm text-indigo-100 sm:text-base">
          {stat.label}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        {display}
      </div>
      <div className="mt-2 text-sm text-indigo-100 sm:text-base">{stat.label}</div>
    </div>
  );
}

export function StatsSection(): ReactElement {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-2 gap-8 gap-y-10 lg:grid-cols-4 lg:gap-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          {STATS.map((stat) => (
            <AnimatedStat key={stat.label} stat={stat} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
