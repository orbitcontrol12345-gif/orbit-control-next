const SITE_URL = 'https://xeltronic.com';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

export async function GET() {
  const pages = [
    '',
    '/products',
    '/brands',
    '/categories',
    '/rfq',
    '/sell-surplus',
    '/contact',
    '/disclaimer',
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `<url>
  <loc>${SITE_URL}${page}</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>${page === '' ? '1.0' : '0.8'}</priority>
</url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
