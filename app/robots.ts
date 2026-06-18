import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
      ],
    },

    sitemap: 'https://www.orbit-surplus.com/sitemap.xml',

    host: 'https://www.orbit-surplus.com',
  };
}
