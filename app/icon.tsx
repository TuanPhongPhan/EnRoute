import { ImageResponse } from 'next/og';

import { EnRouteMark } from '@/components/enroute-logo';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#14B8A6',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <EnRouteMark size={180} variant="pwa" />
      </div>
    ),
    { ...size },
  );
}
