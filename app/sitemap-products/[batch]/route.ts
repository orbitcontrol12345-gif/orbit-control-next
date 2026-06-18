import { getWooProductsPage } from '@/lib/woocommerce';

const SITE_URL = 'https://orbit-surplus.com';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batch: string }> }
) {
  const { batch } = await params;

  const batchNumber = Number(batch.replace('.xml', ''));
  const perPage = 100;
  const pagesPerBatch = 35;

  if (!batchNumber || batchNumber < 1 || batchNumber > 4) {
    return new Response('Not Found', { status: 404 });
  }

  const startPage = (batchNumber - 1) * pagesPerBatch + 1;
  const endPage = batchNumber * pagesPerBatch;

  const pageNumbers = Array.from(
    { length: pagesPerBatch },
    (_, index) => startPage + index
  );

  const results = await Promise.allSettled(
    pageNumbers.map((page) => getWooProductsPage({ page, perPage }))
  );

  const products = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.products : []
  );

  const urls = products
    .filter((product) => product.slug)
    .map((product) => {
      const url = `${SITE_URL}/products/${encodeURIComponent(product.slug)}`;

      return `<url>
  <loc>${escapeXml(url)}</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
