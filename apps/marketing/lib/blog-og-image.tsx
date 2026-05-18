import { ImageResponse } from 'next/og';

export function blogOpenGraphImage(title: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          background:
            'linear-gradient(135deg, hsl(239, 84%, 59%) 0%, hsl(222, 47%, 11%) 100%)',
          padding: 56,
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 16,
            letterSpacing: '0.02em',
          }}
        >
          Senkronize Blog
        </div>
        <div
          style={{
            fontSize: 42,
            color: 'white',
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
