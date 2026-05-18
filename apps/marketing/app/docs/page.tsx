import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { getPanelUrl } from '@/lib/panel-url';

const SWAGGER_URL = 'https://api.senkronize.com/api/docs';
const SWAGGER_ALT = 'https://api.senkronize.com/docs';

export const metadata: Metadata = {
  title: 'Geliştirici API',
  description:
    'Senkronize REST API: kimlik doğrulama, hızlı başlangıç örnekleri ve Swagger dokümantasyonu.',
  openGraph: {
    title: 'Geliştirici API | Senkronize',
    description:
      'Pazaryeri ve ERP entegrasyonu için HTTP API rehberi ve örnek kodlar.',
    url: '/docs',
    locale: 'tr_TR',
    type: 'website',
  },
};

export default function DeveloperDocsPage(): ReactElement {
  const panel = getPanelUrl();

  return (
    <main>
      <section className="border-b border-border bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Geliştirici API&apos;si
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Tek uç nokta üzerinden sipariş, ürün, stok ve entegrasyon otomasyonu.
            Tüm istekler TLS ile şifrelenir; çok kiracılı yapıda{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">
              organizationId
            </code>{' '}
            bağlamı JWT veya API anahtarı ile taşınır.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={SWAGGER_URL}
              className="inline-flex rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
              target="_blank"
              rel="noopener noreferrer"
            >
              Swagger UI&apos;yi aç
            </a>
            <Link
              href="/status"
              className="inline-flex rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-slate-50"
            >
              Sistem durumu
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Alternatif kök yolu:{' '}
            <a
              href={SWAGGER_ALT}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {SWAGGER_ALT}
            </a>{' '}
            (altyapı yönlendirmenize bağlı)
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-slate max-w-none">
          <h2>API özellikleri</h2>
          <ul>
            <li>
              <strong>Kimlik doğrulama:</strong> panel kullanıcıları için JWT Bearer;
              sunucudan sunucuya entegrasyonlar için{' '}
              <code>X-Api-Key</code> başlığı (<code>sk_live_</code> öneki).
            </li>
            <li>
              <strong>Kaynak modeli:</strong> RESTful kaynaklar, tutarlı JSON gövdesi
              ve NestJS tabanlı hata formatı.
            </li>
            <li>
              <strong>Sayfalama:</strong> liste uç noktalarında <code>page</code> ve{' '}
              <code>limit</code>; yanıtta <code>data</code>, <code>total</code>,{' '}
              <code>page</code>, <code>limit</code> alanları.
            </li>
            <li>
              <strong>Webhook&apos;lar:</strong> pazaryeri olayları imza doğrulamalı
              uç noktalarda işlenir (JWT gerektirmez).
            </li>
            <li>
              <strong>Sürümleme:</strong> yol öneki <code>/api/v1/</code>; kırıcı
              değişiklikler yeni sürüm ile duyurulur.
            </li>
          </ul>

          <h2>Hızlı başlangıç</h2>
          <p>
            Aşağıdaki örneklerde <code>API_BASE</code> olarak üretimde{' '}
            <code>https://api.senkronize.com</code>, yerelde{' '}
            <code>http://localhost:3001</code> kullanın.
          </p>

          <h3>TypeScript / JavaScript</h3>
          <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm text-slate-100">
            <code>{`const API_BASE = 'https://api.senkronize.com';
const res = await fetch(\`\${API_BASE}/api/v1/orders?page=1&limit=20\`, {
  headers: {
    Authorization: 'Bearer <access_token>',
    Accept: 'application/json',
  },
});
const body = await res.json();
console.log(body);`}</code>
          </pre>

          <h3>Python</h3>
          <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm text-slate-100">
            <code>{`import requests

API_BASE = "https://api.senkronize.com"
headers = {"X-Api-Key": "sk_live_...", "Accept": "application/json"}
r = requests.get(f"{API_BASE}/api/v1/products", headers=headers, timeout=30)
r.raise_for_status()
print(r.json())`}</code>
          </pre>

          <h3>PHP</h3>
          <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm text-slate-100">
            <code>{`<?php
$api = 'https://api.senkronize.com/api/v1/orders';
$ch = curl_init($api);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . $token,
    'Accept: application/json',
  ],
  CURLOPT_RETURNTRANSFER => true,
]);
$body = curl_exec($ch);
curl_close($ch);
echo $body;`}</code>
          </pre>

          <h3>cURL</h3>
          <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm text-slate-100">
            <code>{`curl -sS \\
  -H "X-Api-Key: sk_live_xxxxxxxx" \\
  -H "Accept: application/json" \\
  "https://api.senkronize.com/api/v1/orders?limit=5"`}</code>
          </pre>

          <h2>Sağlık kontrolü</h2>
          <p>
            Entegrasyonların API&apos;ye erişebildiğini doğrulamak için genel sağlık
            uç noktasını kullanın:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm text-slate-100">
            <code>{`curl -sS "https://api.senkronize.com/api/v1/health"`}</code>
          </pre>
          <p>Örnek yanıt gövdesi:</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-100 p-4 text-sm text-[#111827]">
            <code>{`{
  "status": "ok",
  "timestamp": "2026-05-18T12:00:00.000Z",
  "version": "0.1.0",
  "services": { "database": "up" }
}`}</code>
          </pre>

          <h2>API anahtarı alma</h2>
          <ol>
            <li>
              Panele giriş yapın:{' '}
              <a
                href={`${panel}/login`}
                className="text-primary underline underline-offset-2"
              >
                {panel}/login
              </a>
              .
            </li>
            <li>
              <strong>Ayarlar</strong> sayfasına gidin ve{' '}
              <strong>API anahtarları</strong> sekmesini açın (
              <a
                href={`${panel}/settings`}
                className="text-primary underline underline-offset-2"
              >
                {panel}/settings
              </a>
              ).
            </li>
            <li>
              Yeni anahtar için bir etiket girin; oluşturulduğunda tam gizli değeri
              yalnızca bir kez gösteririz — güvenli bir kasada saklayın.
            </li>
            <li>
              İsteklerde başlık: <code>X-Api-Key: sk_live_…</code>
            </li>
          </ol>

          <h2>Swagger ve sözleşme</h2>
          <p>
            Açık şema ve deneme konsolu için{' '}
            <a
              href={SWAGGER_URL}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Swagger UI
            </a>{' '}
            kullanın. Lisans ve kullanım koşulları için{' '}
            <Link href="/legal/terms" className="text-primary underline underline-offset-2">
              yasal metinler
            </Link>{' '}
            sayfamıza bakın.
          </p>
        </div>
      </section>
    </main>
  );
}
