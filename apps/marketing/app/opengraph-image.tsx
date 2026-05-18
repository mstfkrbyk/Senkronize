import { ImageResponse } from 'next/og';

export const alt = 'Senkronize — Pazaryeri ve ERP entegrasyonu';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, hsl(239, 84%, 59%) 0%, hsl(222, 47%, 11%) 100%)',
          padding: 56,
        }}
      >
        <div
          style={{
            fontSize: 56,
            color: 'white',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          Senkronize
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: 'rgba(255,255,255,0.92)',
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Trendyol, Hepsiburada ve tüm pazaryerlerinizi tek panelden yönetin
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
