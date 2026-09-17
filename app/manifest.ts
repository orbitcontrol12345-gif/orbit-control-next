import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Orbit Control Automation',
    short_name: 'Orbit Control',
    description:
      'Industrial automation and surplus spare parts supplied worldwide.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07111f',
    theme_color: '#07111f',
    categories: ['business', 'shopping'],
    icons: [
      {
        src: '/icons/icon-192-v2.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-v2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512-v2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Browse products',
        short_name: 'Products',
        description: 'Browse available industrial automation parts.',
        url: '/products',
        icons: [
          {
            src: '/icons/icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'Request a quote',
        short_name: 'RFQ',
        description: 'Send a request for quotation to Orbit Control.',
        url: '/rfq',
        icons: [
          {
            src: '/icons/icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],
  };
}
