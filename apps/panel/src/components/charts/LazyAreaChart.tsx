import type { ComponentProps, ReactElement, ReactNode } from 'react';
import type { AreaChart } from 'recharts';
import { Suspense, lazy } from 'react';

type AreaChartProps = ComponentProps<typeof AreaChart>;

const AreaChartLazy = lazy(async () => {
  const { AreaChart } = await import('recharts');
  return { default: AreaChart };
});

interface Props extends AreaChartProps {
  fallback?: ReactNode;
}

/**
 * Recharts AreaChart yalnızca bu bileşen yüklendiğinde ağdan çekilir.
 * Alt öğeler (Area, XAxis vb.) aynı Suspense sınırında recharts modülünden import edilmelidir.
 */
export function LazyAreaChart({
  fallback,
  ...rest
}: Props): ReactElement {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <div
            className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground"
            aria-hidden
          >
            Grafik yükleniyor…
          </div>
        )
      }
    >
      <AreaChartLazy {...rest} />
    </Suspense>
  );
}
