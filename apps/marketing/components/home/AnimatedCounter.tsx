'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import type { ReactElement } from 'react';

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  duration?: number;
}

export function AnimatedCounter({
  target,
  suffix = '+',
  duration = 2000,
}: AnimatedCounterProps): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const startTime = performance.now();

    function tick(now: number): void {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className="font-bold text-primary">
      {count.toLocaleString('tr-TR')}
      {suffix}
    </span>
  );
}
