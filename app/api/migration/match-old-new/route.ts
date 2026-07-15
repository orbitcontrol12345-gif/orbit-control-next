import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'MIGRATION-MATCHER-V1-SAFE';
const OLD_SITE = 'https://www.orbit-surplus.com';

const OLD_URL_BATCH = 500;
const PRODUCT_PAGE_SIZE = 1000;
const MAX_SITEMAPS = 100;
const MAX_REVIEW_CANDIDATES = 5;

type MatchLevel =
  | 'EXACT_MATCH'
  | 'STRONG_MATCH'
  | 'REVIEW'
  | 'NO_MATCH';

type ProductRow = {
  id: number | string;
  ebay_item_id: string | null;
  brand: string | null;
  part_number: string | null;
  name: string | null;
  slug: string | null;
  marketplace: string | null;
  is_active: boolean | null;
};

type MatchCandidate = {
  product: ProductRow;
  score: number;
  reasons: string[];
  titleSimilarity: number;
};

const POSSIBLE_SITEMAPS = [
  '/sitemap_index.xml',
  '/sitemap.xml',
  '/wp-sitemap.xml',
  '/product-sitemap.xml',
  '/product-sitemap1.xml',
  '/product-sitemap2.xml',
];

const SLUG_NOISE = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'REFURBISHED',
  'TESTED',
  'TRIED',
  'OK',
  'LOT',
  'LOTS',
  'PCS',
  'PC',
  'PIECE',
  'PIECES',
  'UNIT',
  'UNITS',
  'ITEM',
  'ITEMS',
  'PACK',
  'SET',
  'WITH',
  'WITHOUT',
  'WO',
  'NO',
  'THE',
  'A',
  'AN',
  'AND',
  'OR',
  'FOR',
  'OF',
  'IN',
  'ON',
  'TO',
  'FROM',
  'ONLY',
  'TOP',
  'CONDITION',
]);

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractLocs(xml: string): string[] {
  return Array.from(
    new Set(
      Array.from(
        xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)
      )
        .map((match) =>
          decodeXml(String(match[1] || '').trim())
        )
        .filter(Boolean)
    )
  );
}

function looksLikeSitemapUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    return path.includes('sitemap') && path.endsWith('.xml');
  } catch {
    return false;
  }
}

function looksLikeProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().startsWith('/product/');
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<{
  ok: boolean;
  status: number;
  text: string;
}> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OrbitMigrationMatcher/1.0)',
        Accept: 'application/xml,text/xml,text/plain,*/*',
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      text: '',
    };
  }
}

async function discoverOldProductUrls(): Promise<string[]> {
  const productUrls = new Set<string>();
  const sitemapQueue: string[] = [];
  const queuedSitemaps = new Set<string>();
  const visitedSitemaps = new Set<string>();

  function queueSitemap(url: string) {
    if (
      !queuedSitemaps.has(url) &&
      !visitedSitemaps.has(url)
    ) {
      queuedSitemaps.add(url);
      sitemapQueue.push(url);
    }
  }

  for (const path of POSSIBLE_SITEMAPS) {
    queueSitemap(`${OLD_SITE}${path}`);
  }

  while (
    sitemapQueue.length > 0 &&
    visitedSitemaps.size < MAX_SITEMAPS
  ) {
    const sitemapUrl = sitemapQueue.shift();

    if (!sitemapUrl) continue;

    queuedSitemaps.delete(sitemapUrl);

    if (visitedSitemaps.has(sitemapUrl)) {
      continue;
    }

    visitedSitemaps.add(sitemapUrl);

    const result = await fetchText(sitemapUrl);

    if (!result.ok) {
      continue;
    }

    const locs = extractLocs(result.text);

    for (const loc of locs) {
      if (looksLikeSitemapUrl(loc)) {
        queueSitemap(loc);
      }

      if (looksLikeProductUrl(loc)) {
        productUrls.add(loc);
      }
    }
  }

  return Array.from(productUrls).sort();
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const products: ProductRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        brand,
        part_number,
        name,
        slug,
        marketplace,
        is_active
      `)
      .eq('marketplace', 'EBAY_US')
      .order('id', { ascending: true })
      .range(from, from + PRODUCT_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = (data || []) as ProductRow[];

    products.push(...rows);

    if (rows.length < PRODUCT_PAGE_SIZE) {
      break;
    }

    from += PRODUCT_PAGE_SIZE;
  }

  return products;
}

function normalizeCompact(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[‐‑‒–—_]/g, '-')
    .replace(/[^A-Z0-9]+/g, '');
}

function normalizePartNumber(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—_]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9./-]/g, '');
}

function normalizeBrand(value: unknown): string {
  return normalizeCompact(value);
}

function tokenize(value: unknown): Set<string> {
  const tokens = String(value || '')
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[‐‑‒–—_]/g, '-')
    .replace(/[^A-Z0-9./-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length > 1)
    .filter((token) => !SLUG_NOISE.has(token));

  return new Set(tokens);
}

function similarity(a: unknown, b: unknown): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (!aTokens.size || !bTokens.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection++;
    }
  }

  const union = new Set([
    ...Array.from(aTokens),
    ...Array.from(bTokens),
  ]).size;

  return union ? intersection / union : 0;
}

function getOldSlug(oldUrl: string): string {
  try {
    const parsed = new URL(oldUrl);

    return parsed.pathname
      .replace(/^\/product\//i, '')
      .replace(/\/+$/, '')
      .trim();
  } catch {
    return '';
  }
}

function getNewUrl(product: ProductRow): string | null {
  const slug = String(product.slug || '').trim();

  if (!slug) {
    return null;
  }

  return `/products/${slug}`;
}

function isUsefulPartNumber(value: unknown): boolean {
  const partNumber = normalizePartNumber(value);

  if (!partNumber) return false;
  if (/^\d{10,14}$/.test(partNumber)) return false;

  if (/^(UNKNOWN|NONE|NA|N\/A)$/.test(partNumber)) {
    return false;
  }

  return true;
}

function scoreCandidate(
  oldSlug: string,
  product: ProductRow
): MatchCandidate {
  let score = 0;
  const reasons: string[] = [];

  const oldCompact = normalizeCompact(oldSlug);
  const oldTokens = tokenize(oldSlug);

  const partNumber = normalizePartNumber(
    product.part_number
  );

  const partCompact = normalizeCompact(partNumber);
  const brandCompact = normalizeBrand(product.brand);
  const ebayItemId = String(
    product.ebay_item_id || ''
  ).trim();

  const titleSimilarity = Math.max(
    similarity(oldSlug, product.name),
    similarity(oldSlug, product.slug)
  );

  if (
    ebayItemId &&
    oldCompact.includes(normalizeCompact(ebayItemId))
  ) {
    score += 1000;
    reasons.push('ebay_item_id_found_in_old_url');
  }

  if (
    isUsefulPartNumber(partNumber) &&
    partCompact.length >= 4 &&
    oldCompact.includes(partCompact)
  ) {
    score += 650;
    reasons.push('exact_part_number_found_in_old_slug');
  }

  if (
    brandCompact.length >= 2 &&
    oldCompact.includes(brandCompact)
  ) {
    score += 120;
    reasons.push('brand_found_in_old_slug');
  }

  if (
    isUsefulPartNumber(partNumber) &&
    brandCompact &&
    partCompact.length >= 4 &&
    oldCompact.includes(partCompact) &&
    oldCompact.includes(brandCompact)
  ) {
    score += 180;
    reasons.push('brand_and_part_number_match');
  }

  if (titleSimilarity >= 0.95) {
    score += 400;
    reasons.push('title_similarity_95_plus');
  } else if (titleSimilarity >= 0.85) {
    score += 300;
    reasons.push('title_similarity_85_plus');
  } else if (titleSimilarity >= 0.72) {
    score += 180;
    reasons.push('title_similarity_72_plus');
  } else if (titleSimilarity >= 0.6) {
    score += 80;
    reasons.push('title_similarity_60_plus');
  }

  const productNameTokens = tokenize(product.name);
  let sharedStrongTokens = 0;

  for (const token of oldTokens) {
    if (
      token.length >= 5 &&
      productNameTokens.has(token)
    ) {
      sharedStrongTokens++;
    }
  }

  if (sharedStrongTokens >= 3) {
    score += 120;
    reasons.push('three_or_more_strong_tokens_match');
  } else if (sharedStrongTokens === 2) {
    score += 70;
    reasons.push('two_strong_tokens_match');
  }

  if (product.is_active === false) {
    score -= 50;
    reasons.push('inactive_product_penalty');
  }

  return {
    product,
    score,
    reasons,
    titleSimilarity,
  };
}

function classifyCandidates(
  candidates: MatchCandidate[]
): {
  level: MatchLevel;
  best: MatchCandidate | null;
  review: MatchCandidate[];
  scoreGap: number | null;
} {
  const sorted = [...candidates]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.titleSimilarity - a.titleSimilarity;
    });

  if (sorted.length === 0) {
    return {
      level: 'NO_MATCH',
      best: null,
      review: [],
      scoreGap: null,
    };
  }

  const best = sorted[0];
  const second = sorted[1] || null;
  const scoreGap = second
    ? best.score - second.score
    : best.score;

  const hasExactPart =
    best.reasons.includes(
      'exact_part_number_found_in_old_slug'
    );

  const hasBrandPart =
    best.reasons.includes(
      'brand_and_part_number_match'
    );

  const hasEbayId =
    best.reasons.includes(
      'ebay_item_id_found_in_old_url'
    );

  if (
    hasEbayId &&
    best.score >= 1000 &&
    scoreGap >= 250
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
    };
  }

  if (
    hasExactPart &&
    hasBrandPart &&
    best.score >= 900 &&
    scoreGap >= 180
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
    };
  }

  if (
    hasExactPart &&
    best.score >= 720 &&
    scoreGap >= 150
  ) {
    return {
      level: 'STRONG_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
    };
  }

  if (
    best.score >= 500 &&
    best.titleSimilarity >= 0.72 &&
    scoreGap >= 120
  ) {
    return {
      level: 'STRONG_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
    };
  }

  if (best.score >= 180) {
    return {
      level: 'REVIEW',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
    };
  }

  return {
    level: 'NO_MATCH',
    best: null,
    review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
    scoreGap,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const offset = Math.max(
      0,
      Number(url.searchParams.get('offset') || 0)
    );

    const [oldProductUrls, products] =
      await Promise.all([
        discoverOldProductUrls(),
        fetchAllProducts(),
      ]);

    const oldUrlBatch = oldProductUrls.slice(
      offset,
      offset + OLD_URL_BATCH
    );

    const productByPartNumber = new Map<
      string,
      ProductRow[]
    >();

    const productByEbayItemId = new Map<
      string,
      ProductRow
    >();

    for (const product of products) {
      const partNumber = normalizePartNumber(
        product.part_number
      );

      if (isUsefulPartNumber(partNumber)) {
        const current =
          productByPartNumber.get(partNumber) || [];

        current.push(product);
        productByPartNumber.set(partNumber, current);
      }

      const ebayItemId = String(
        product.ebay_item_id || ''
      ).trim();

      if (ebayItemId) {
        productByEbayItemId.set(
          normalizeCompact(ebayItemId),
          product
        );
      }
    }

    let exactMatches = 0;
    let strongMatches = 0;
    let reviewMatches = 0;
    let noMatches = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const oldUrl of oldUrlBatch) {
      const oldSlug = getOldSlug(oldUrl);
      const oldCompact = normalizeCompact(oldSlug);

      const candidateMap = new Map<
        string,
        ProductRow
      >();

      for (const [
        ebayItemId,
        product,
      ] of productByEbayItemId.entries()) {
        if (
          ebayItemId.length >= 8 &&
          oldCompact.includes(ebayItemId)
        ) {
          candidateMap.set(
            String(product.id),
            product
          );
        }
      }

      for (const [
        partNumber,
        matchingProducts,
      ] of productByPartNumber.entries()) {
        const compactPart =
          normalizeCompact(partNumber);

        if (
          compactPart.length >= 4 &&
          oldCompact.includes(compactPart)
        ) {
          for (const product of matchingProducts) {
            candidateMap.set(
              String(product.id),
              product
            );
          }
        }
      }

      if (candidateMap.size < 20) {
        for (const product of products) {
          if (
            candidateMap.has(String(product.id))
          ) {
            continue;
          }

          const quickSimilarity = Math.max(
            similarity(oldSlug, product.name),
            similarity(oldSlug, product.slug)
          );

          if (quickSimilarity >= 0.55) {
            candidateMap.set(
              String(product.id),
              product
            );
          }
        }
      }

      const candidates = Array.from(
        candidateMap.values()
      ).map((product) =>
        scoreCandidate(oldSlug, product)
      );

      const classification =
        classifyCandidates(candidates);

      if (classification.level === 'EXACT_MATCH') {
        exactMatches++;
      } else if (
        classification.level === 'STRONG_MATCH'
      ) {
        strongMatches++;
      } else if (
        classification.level === 'REVIEW'
      ) {
        reviewMatches++;
      } else {
        noMatches++;
      }

      const best = classification.best;

      results.push({
        oldUrl,
        oldSlug,
        matchLevel: classification.level,
        score: best?.score ?? 0,
        scoreGap: classification.scoreGap,
        reasons: best?.reasons ?? [],
        titleSimilarity: best
          ? Number(best.titleSimilarity.toFixed(4))
          : 0,
        matchedProductId: best?.product.id ?? null,
        ebayItemId:
          best?.product.ebay_item_id ?? null,
        brand: best?.product.brand ?? null,
        partNumber:
          best?.product.part_number ?? null,
        productName: best?.product.name ?? null,
        newUrl: best
          ? getNewUrl(best.product)
          : null,
        reviewCandidates:
          classification.level === 'REVIEW'
            ? classification.review.map(
                (candidate) => ({
                  productId: candidate.product.id,
                  ebayItemId:
                    candidate.product.ebay_item_id,
                  brand: candidate.product.brand,
                  partNumber:
                    candidate.product.part_number,
                  productName:
                    candidate.product.name,
                  newUrl: getNewUrl(
                    candidate.product
                  ),
                  score: candidate.score,
                  titleSimilarity: Number(
                    candidate.titleSimilarity.toFixed(4)
                  ),
                  reasons: candidate.reasons,
                })
              )
            : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      mode: 'preview-only-no-write-no-redirect',
      oldSite: OLD_SITE,
      totalOldProductUrls: oldProductUrls.length,
      totalNewProducts: products.length,
      offset,
      batchSize: OLD_URL_BATCH,
      oldUrlsScanned: oldUrlBatch.length,
      exactMatches,
      strongMatches,
      reviewMatches,
      noMatches,
      matchedSafeTotal:
        exactMatches + strongMatches,
      nextOffset:
        offset + oldUrlBatch.length <
        oldProductUrls.length
          ? offset + oldUrlBatch.length
          : null,
      rules: {
        exactMatch: [
          'eBay item id in old URL with strong score gap',
          'or exact part number + brand with high score and strong score gap',
        ],
        strongMatch: [
          'exact part number with strong score gap',
          'or strong title similarity with sufficient score gap',
        ],
        review: [
          'plausible candidate exists but confidence is not safe for automatic redirect',
        ],
        noMatch: [
          'no sufficiently credible new product candidate found',
        ],
        writeMode: false,
        redirectMode: false,
      },
      results,
    });
  } catch (error) {
    console.error(
      'MIGRATION MATCHER V1 ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
