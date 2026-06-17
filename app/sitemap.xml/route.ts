const SITE_URL = 'https://xeltronic.com';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

export async function GET() {
  const sitemaps = [
    `${SITE_URL}/sitemap-static.xml`,
    `${SITE_URL}/sitemap-products/1.xml`,
    `${SITE_URL}/sitemap-products/2.xml`,
    `${SITE_URL}/sitemap-products/3.xml`,
    `${SITE_URL}/sitemap-products/4.xml`,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `<sitemap>
  <loc>${url}</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
</sitemap>`
  )
  .join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
