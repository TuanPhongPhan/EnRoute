'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    // Avoid a development service worker caching changing local assets; Push API testing therefore needs `npm run start`.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return null;
}
