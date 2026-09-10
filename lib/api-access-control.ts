const PUBLIC_API_PATHS = new Set([
  '/api/admin/login',
  '/api/contact',
  '/api/rfq',
  '/api/search-products',
  '/api/sell-surplus',
]);

/*
 * CRON_SECRET is deliberately limited to scheduled jobs and the exact
 * internal endpoints those jobs call. It must never authorize /api/admin.
 */
const CRON_API_PATHS = new Set([
  '/api/catalog/brands/test-aggregator',
  '/api/catalog/build-brand-intelligence',
  '/api/catalog/deduplicate-apply',
  '/api/catalog/final-cleanup',
  '/api/catalog/fix-brands-auto',
  '/api/catalog/fix-part-numbers-auto',
  '/api/catalog/repair-old-images',
  '/api/catalog/sync-r2-images-v6',
  '/api/ebay/auto-import',
  '/api/ebay/import-us-feed',
  '/api/ebay/process-queue',
  '/api/ebay/rebuild-catalog',
  '/api/ebay/sync-us',
  '/api/ebay/sync-v2',
  '/api/ebay-products',
  '/api/migration/bridge-health',
  '/api/migration/match-old-new',
  '/api/migration/save-bridge',
  '/api/sync-state',
]);

const PRODUCTION_DIAGNOSTIC_PATHS = new Set([
  '/api/r2/test-upload',
  '/api/test-ebay',
  '/api/test-part-number',
  '/api/test-part-number-db',
  '/api/test-supabase',
  '/api/test-woo',
  '/api/ebay/diagnostic',
  '/api/ebay/test-clean-title',
  '/api/ebay/test-feed',
  '/api/ebay/test-inventory',
  '/api/ebay/test-token',
  '/api/catalog/test-brand-scoring',
  '/api/catalog/test-unknown-brands',
  '/api/catalog/brands/test-dictionary',
  '/api/catalog/brands/test-extractor',
  '/api/catalog/brands/test-real-resolution',
  '/api/catalog/brands/test-repository',
]);

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.has(pathname);
}

export function isCronApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/cron/') || CRON_API_PATHS.has(pathname);
}

export function isProductionDiagnosticPath(pathname: string): boolean {
  return PRODUCTION_DIAGNOSTIC_PATHS.has(pathname);
}
