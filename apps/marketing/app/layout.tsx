import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Senkronize',
  description: 'Pazaryeri ve ERP entegrasyon platformu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
