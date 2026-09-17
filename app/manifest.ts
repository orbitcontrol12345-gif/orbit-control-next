import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Orbit Control Automation',
    short_name: 'Orbit Control',
    description:
      'Industrial automation, electrical, obsolete and surplus spare parts supplied worldwide.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07111f',
    theme_color: '#07111f',
    orientation: 'any',
    lang: 'en',
    categories: ['business', 'shopping'],
    icons: [
      {
        src: '/icons/orbit-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/orbit-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/orbit-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
