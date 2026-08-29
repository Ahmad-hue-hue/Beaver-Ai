import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'Beaver — Business OS. Sell faster, track everything, know what’s next. AI-powered point of sale, stock and customers for your shop.';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #022c22 0%, #065f46 45%, #039855 100%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700 }}>Beaver</div>
          <div
            style={{
              fontSize: 30,
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 999,
              padding: '8px 18px',
            }}
          >
            Business OS
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          Sell faster. Track everything.
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: '#6ce9a6' }}>
          Know what’s next.
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Point of sale · Stock & reorders · Customers & debt · AI insights
        </div>
      </div>
    ),
    size,
  );
}
