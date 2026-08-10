const SITE_URL = 'https://www.orbit-surplus.com';

export const dynamic = 'force-static';
export const revalidate = 86400;

export async function GET() {
  const lastModified = new Date().toISOString();

  const sitemaps = [
    `${SITE_URL}/sitemap-static.xml`,
    `${SITE_URL}/sitemap-products/1.xml`,
    `${SITE_URL}/sitemap-products/2.xml`,
    `${SITE_URL}/sitemap-products/3.xml`,
    `${SITE_URL}/sitemap-products/4.xml`,
    `${SITE_URL}/sitemap-products/5.xml`,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${lastModified}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control':
        'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}