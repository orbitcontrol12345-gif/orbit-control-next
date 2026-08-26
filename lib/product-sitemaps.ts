export const PRODUCT_SITEMAP_PAGE_SIZE = 100;
export const PRODUCT_SITEMAP_PAGES_PER_BATCH = 35;

const PRODUCTS_PER_SITEMAP =
  PRODUCT_SITEMAP_PAGE_SIZE *
  PRODUCT_SITEMAP_PAGES_PER_BATCH;

const FALLBACK_PRODUCT_SITEMAP_COUNT = 5;

export function getProductSitemapCount(
  productCount: number | null,
): number {
  if (
    productCount === null ||
    !Number.isFinite(productCount) ||
    productCount < 0
  ) {
    return FALLBACK_PRODUCT_SITEMAP_COUNT;
  }

  return Math.ceil(
    Math.floor(productCount) / PRODUCTS_PER_SITEMAP,
  );
}

export function getProductSitemapUrls(
  siteUrl: string,
  sitemapCount: number,
): string[] {
  return Array.from(
    { length: sitemapCount },
    (_, index) =>
      `${siteUrl}/sitemap-products/${index + 1}.xml`,
  );
}
