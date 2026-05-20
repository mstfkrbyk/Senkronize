import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Senkronize — Pazaryeri ve ERP entegrasyonu';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PLATFORMS = [
  'Trendyol',
  'Hepsiburada',
  'N11',
  'Amazon',
  'Etsy',
  'Shopify',
];

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, hsl(239, 84%, 59%) 0%, hsl(222, 47%, 11%) 100%)',
          padding: 48,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 800,
              color: 'white',
            }}
          >
            S
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 52,
                color: 'white',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Senkronize
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Tüm pazaryerlerinizi tek panelden yönetin
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {PLATFORMS.map((name) => (
            <div
              key={name}
              style={{
                padding: '12px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: 18,
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          senkronize.com · 150+ entegrasyon · %99.9 uptime
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
