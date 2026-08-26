import { BRANDS, CATEGORIES } from '@/lib/data';

const SITE_URL = 'https://www.orbit-surplus.com';
const FEATURED_BRAND_SLUGS = [
  'ge',
  'fanuc',
  'mitsubishi',
  'yaskawa',
];

export const dynamic = 'force-static';
export const revalidate = 86400;

type SitemapPage = {
  path: string;
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const staticPages: SitemapPage[] = [
    {
      path: '',
      priority: '1.0',
      changefreq: 'daily',
    },
    {
      path: '/products',
      priority: '0.9',
      changefreq: 'daily',
    },
    {
      path: '/brands',
      priority: '0.9',
      changefreq: 'weekly',
    },
    {
      path: '/manufacturers',
      priority: '0.9',
      changefreq: 'weekly',
    },
    {
      path: '/categories',
      priority: '0.9',
      changefreq: 'weekly',
    },
    {
      path: '/rfq',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/sell-surplus',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/contact',
      priority: '0.7',
      changefreq: 'yearly',
    },
    {
      path: '/about',
      priority: '0.7',
      changefreq: 'yearly',
    },
    {
      path: '/shipping-policy',
      priority: '0.5',
      changefreq: 'yearly',
    },
    {
      path: '/warranty-policy',
      priority: '0.5',
      changefreq: 'yearly',
    },
    {
      path: '/privacy-policy',
      priority: '0.4',
      changefreq: 'yearly',
    },
    {
      path: '/disclaimer',
      priority: '0.3',
      changefreq: 'yearly',
    },
  ];

  const categoryPages: SitemapPage[] = CATEGORIES.map(
    (category) => ({
      path: `/categories/${encodeURIComponent(category.slug)}`,
      priority: '0.8',
      changefreq: 'weekly',
    }),
  );

  const brandSlugs = Array.from(
    new Set([
      ...BRANDS.map((brand) => brand.slug),
      ...FEATURED_BRAND_SLUGS,
    ]),
  );

  const brandPages: SitemapPage[] = brandSlugs.map((slug) => ({
    path: `/brands/${encodeURIComponent(slug)}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const pages = [
    ...staticPages,
    ...categoryPages,
    ...brandPages,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(({ path, priority, changefreq }) => {
    const url = escapeXml(`${SITE_URL}${path}`);

    return `  <url>
    <loc>${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control':
        'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}
