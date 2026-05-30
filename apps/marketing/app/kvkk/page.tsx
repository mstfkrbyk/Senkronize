import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description:
    'Senkronize KVKK kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.',
  robots: { index: false, follow: false },
};

export default function KvkkPage(): ReactElement {
  return (
    <main className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#111827]">KVKK Aydınlatma Metni</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Son güncelleme: Mayıs 2026 — Özet bilgilendirme metnidir; kesin hukuki metin
          avukat onayıyla yayınlanacaktır.
        </p>
        <p className="mt-6 text-muted-foreground">
          6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusuna
          ilişkin aydınlatma metni hazırlanmaktadır. Kişisel verilerinizin işlenmesi,
          haklarınız ve başvuru yöntemi için{' '}
          <a
            href="/legal/privacy"
            className="text-primary underline-offset-4 hover:underline"
          >
            Gizlilik Politikası
          </a>{' '}
          sayfasına bakabilirsiniz.
        </p>
        <p className="mt-4 text-muted-foreground">
          KVKK kapsamındaki talep ve başvurularınızı{' '}
          <a
            href="mailto:kvkk@senkronize.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            kvkk@senkronize.com
          </a>{' '}
          adresine iletebilirsiniz.
        </p>
      </div>
    </main>
  );
}
