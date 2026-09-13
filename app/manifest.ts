import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EnRoute — HNU Commute Companion',
    short_name: 'EnRoute',
    description: 'Know when to leave, which connection to take, and how to use your journey well.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7fafc',
    theme_color: '#14b8a6',
    lang: 'en',
    icons: [
      { src: '/icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '180x180', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
