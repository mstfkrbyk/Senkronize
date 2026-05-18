import type { Metadata } from 'next';
import type { ReactNode, ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Demo talebi',
  description:
    'Senkronize ürününü işletmeniz için canlı demo ile keşfedin; ekibimiz kısa sürede size dönüş yapar.',
};

export default function DemoLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return <>{children}</>;
}
