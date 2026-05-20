import { useEffect, useRef, useState } from 'react';

export function useCountUp(end: number, duration = 1000): number {
  const [value, setValue] = useState(end);
  const prevEnd = useRef(end);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevEnd.current;
    prevEnd.current = end;

    if (!Number.isFinite(end)) {
      setValue(0);
      return undefined;
    }

    if (start === end) {
      setValue(end);
      return undefined;
    }

    const startTime = performance.now();

    const animate = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(start + (end - start) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(end);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return (): void => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration]);

  return value;
}
