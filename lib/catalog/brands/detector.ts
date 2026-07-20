import { loadRegistryBrands } from './brand-repository';
import { normalizeBrand } from './promotion-filters';

let cache: Map<string, string> | null = null;
let lastLoaded = 0;

const CACHE_TIME = 5 * 60 * 1000;

async function loadCache() {
  const now = Date.now();

  if (cache && now - lastLoaded < CACHE_TIME) {
    return cache;
  }

  const brands = await loadRegistryBrands();

  cache = new Map();

  for (const brand of brands) {
    if (brand.status && brand.status !== 'active') {
      continue;
    }

    cache.set(
      normalizeBrand(
        brand.normalized_brand ||
          brand.canonical_brand
      ),
      brand.canonical_brand
    );
  }

  lastLoaded = now;

  return cache;
}

export async function detectBrand(
  title: string
) {
  const registry = await loadCache();

  const upper = title.toUpperCase();

  for (const [normalized, canonical] of registry) {
    if (upper.includes(normalized)) {
      return canonical;
    }
  }

  return 'UNKNOWN';
}
