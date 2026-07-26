import type { MetadataRoute } from 'next';

const SITE_URL = 'https://orbit-surplus.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
        ],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
    ],

    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
