import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Senkronize blog — e-ticaret ve entegrasyon içerikleri yakında.',
};

export default function BlogPage(): ReactElement {
  return (
    <main className="bg-[#F9FAFB] py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold text-[#111827] sm:text-4xl">Blog</h1>
        <p className="mt-4 text-muted-foreground">
          Yakında e-ticaret ipuçları, entegrasyon rehberleri ve ürün güncellemeleri
          burada olacak.
        </p>
      </div>
    </main>
  );
}
