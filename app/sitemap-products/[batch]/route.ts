import {
  getSupabaseProductsPage,
  getVisibleProductsCount,
} from '@/lib/supabase-products';
import {
  getProductSitemapCount,
  PRODUCT_SITEMAP_PAGES_PER_BATCH,
  PRODUCT_SITEMAP_PAGE_SIZE,
} from '@/lib/product-sitemaps';

const SITE_URL = 'https://www.orbit-surplus.com';

export const dynamic = 'force-static';
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatLastModified(
  value?: string,
): string | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime())
    ? null
    : timestamp.toISOString();
}

function parseBatchNumber(
  value: string,
  sitemapCount: number,
): number | null {
  const normalizedValue = value.replace(/\.xml$/i, '');
  const batchNumber = Number(normalizedValue);

  if (
    !Number.isInteger(batchNumber) ||
    batchNumber < 1 ||
    batchNumber > sitemapCount
  ) {
    return null;
  }

  return batchNumber;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      batch: string;
    }>;
  },
) {
  const { batch } = await params;
  const productCount = await getVisibleProductsCount();
  const productSitemapCount =
    getProductSitemapCount(productCount);
  const batchNumber = parseBatchNumber(
    batch,
    productSitemapCount,
  );

  if (!batchNumber) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const startPage =
    (batchNumber - 1) *
      PRODUCT_SITEMAP_PAGES_PER_BATCH +
    1;

  const pageNumbers = Array.from(
    {
      length: PRODUCT_SITEMAP_PAGES_PER_BATCH,
    },
    (_, index) => startPage + index,
  );

  const results = await Promise.allSettled(
    pageNumbers.map((page) =>
      getSupabaseProductsPage({
        page,
        perPage: PRODUCT_SITEMAP_PAGE_SIZE,
      }),
    ),
  );

  const failedRequests = results.filter(
    (result) => result.status === 'rejected',
  );

  if (failedRequests.length === results.length) {
    return new Response(
      'Unable to generate product sitemap',
      {
        status: 503,
        headers: {
          'Content-Type':
            'text/plain; charset=utf-8',
          'Retry-After': '3600',
        },
      },
    );
  }

  if (failedRequests.length > 0) {
    console.error(
      `Product sitemap batch ${batchNumber}: ${failedRequests.length} Supabase page requests failed.`,
    );
  }

  const products = results.flatMap((result) => {
    if (result.status !== 'fulfilled') {
      return [];
    }

    return result.value.products;
  });

  const uniqueProducts = Array.from(
    new Map(
      products
        .filter(
          (product) =>
            typeof product.slug === 'string' &&
            product.slug.trim().length > 0,
        )
        .map((product) => [
          product.slug.trim(),
          product,
        ]),
    ).values(),
  );

  
  const urls = uniqueProducts
    .map((product) => {
      const productUrl =
        `${SITE_URL}/products/` +
        encodeURIComponent(product.slug.trim());
      const lastModified = formatLastModified(
        product.updatedAt || product.createdAt,
      );

      return `  <url>
    <loc>${escapeXml(productUrl)}</loc>
${lastModified ? `    <lastmod>${lastModified}</lastmod>\n` : ''}    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

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
