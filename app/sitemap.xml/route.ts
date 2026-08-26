import { getVisibleProductsCount } from '@/lib/supabase-products';
import {
  getProductSitemapCount,
  getProductSitemapUrls,
} from '@/lib/product-sitemaps';

const SITE_URL = 'https://www.orbit-surplus.com';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const productCount = await getVisibleProductsCount();
  const productSitemapCount =
    getProductSitemapCount(productCount);
  const sitemaps = [
    `${SITE_URL}/sitemap-static.xml`,
    ...getProductSitemapUrls(
      SITE_URL,
      productSitemapCount,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `  <sitemap>
    <loc>${url}</loc>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type':
        'application/xml; charset=utf-8',
      'Cache-Control':
        'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
