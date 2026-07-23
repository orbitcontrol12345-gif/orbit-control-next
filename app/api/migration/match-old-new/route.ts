import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'MIGRATION-MATCHER-V4-FINAL-SAFE';
const OLD_SITE = 'https://www.orbit-surplus.com';

const OLD_URL_BATCH = 50;
const PRODUCT_PAGE_SIZE = 1000;
const MAX_SITEMAPS = 100;
const MAX_REVIEW_CANDIDATES = 5;

type MatchLevel =
  | 'EXACT_MATCH'
  | 'STRONG_MATCH'
  | 'REVIEW'
  | 'NO_MATCH'
  | 'OLD_PAGE_FETCH_FAILED';

type ProductRow = {
  id: number | string;
  ebay_item_id: string | null;
  brand: string | null;
  part_number: string | null;
  model_number: string | null;
  sku: string | null;
  name: string | null;
  slug: string | null;
  marketplace: string | null;
  is_active: boolean | null;
};

type OldPageData = {
  ok: boolean;
  status: number;
  oldUrl: string;
  finalUrl: string;
  title: string;
  h1: string;
  schemaName: string;
  schemaSku: string;
  schemaMpn: string;
  schemaBrand: string;
  visibleSku: string;
  visibleMpn: string;
  error: string | null;
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

const TITLE_NOISE = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'REFURBISHED',
  'SELLER',
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
  'BUY',
  'ONLINE',
  'ORBIT',
  'CONTROL',
  'AUTOMATION',
]);

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtml(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
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
  finalUrl: string;
  text: string;
}> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OrbitMigrationMatcher/3.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml,text/xml,*/*',
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      text: await response.text(),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
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

    if (!result.ok) continue;

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
        model_number,
        sku,
        name,
        slug,
        marketplace,
        is_active
      `)
      .eq('marketplace', 'EBAY_US')
      .order('id', { ascending: true })
      .range(from, from + PRODUCT_PAGE_SIZE - 1);

    if (error) throw error;

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
    .filter((token) => !TITLE_NOISE.has(token));

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

function isUsefulPartNumber(value: unknown): boolean {
  const partNumber = normalizePartNumber(value);

  if (!partNumber) return false;
  if (/^\d{10,14}$/.test(partNumber)) return false;

  if (/^(UNKNOWN|NONE|NA|N\/A)$/i.test(partNumber)) {
    return false;
  }

  if (
    /^(?:LOT|QTY|QUANTITY|PACK|SET)[-_/]?\d+$/i.test(partNumber) ||
    /^\d+[-_/]?(?:PCS?|PIECES?|UNITS?|ITEMS?)$/i.test(partNumber) ||
    /^(?:PCS?|PIECES?|UNITS?|ITEMS?)[-_/]?\d+$/i.test(partNumber)
  ) {
    return false;
  }

  if (
    /^(?:ASHTEAD|HONEYWELL-XNX|WAGO-750|BOX-\d+|VALVE-\d+)$/i.test(
      partNumber
    )
  ) {
    return false;
  }

  return true;
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

  return slug ? `/products/${slug}` : null;
}

function getMetaContent(
  html: string,
  propertyOrName: string
): string {
  const escaped = propertyOrName.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      'i'
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return '';
}

function getFirstHeading(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

  return match?.[1] ? stripHtml(match[1]) : '';
}

function collectProductSchemas(value: unknown): Record<string, any>[] {
  const results: Record<string, any>[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }

      return;
    }

    const record = node as Record<string, any>;
    const type = record['@type'];

    const types = Array.isArray(type)
      ? type.map((item) => String(item).toLowerCase())
      : [String(type || '').toLowerCase()];

    if (types.includes('product')) {
      results.push(record);
    }

    for (const child of Object.values(record)) {
      walk(child);
    }
  }

  walk(value);

  return results;
}

function extractProductSchema(html: string): Record<string, any> | null {
  const scripts = Array.from(
    html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  );

  const products: Record<string, any>[] = [];

  for (const script of scripts) {
    const raw = String(script[1] || '').trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      products.push(...collectProductSchemas(parsed));
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  if (!products.length) {
    return null;
  }

  return products.sort((a, b) => {
    const score = (value: Record<string, any>) =>
      Number(Boolean(value.mpn)) * 4 +
      Number(Boolean(value.sku)) * 3 +
      Number(Boolean(value.brand)) * 2 +
      Number(Boolean(value.name));

    return score(b) - score(a);
  })[0];
}

function schemaBrandValue(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>;

    return String(
      record.name ||
        record.brand ||
        record.value ||
        ''
    ).trim();
  }

  return '';
}

function extractVisibleIdentifier(
  html: string,
  labels: string[]
): string {
  const text = stripHtml(html);

  for (const label of labels) {
    const escaped = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const pattern = new RegExp(
      `\\b${escaped}\\b\\s*[:#-]?\\s*([A-Z0-9][A-Z0-9._/\\- ]{2,40})`,
      'i'
    );

    const match = text.match(pattern);

    if (match?.[1]) {
      return String(match[1])
        .split(/\s{2,}|(?:\s+-\s+)|(?:\s+\|\s+)/)[0]
        .trim();
    }
  }

  return '';
}

async function fetchOldPageData(
  oldUrl: string
): Promise<OldPageData> {
  const result = await fetchText(oldUrl);

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      oldUrl,
      finalUrl: result.finalUrl,
      title: '',
      h1: '',
      schemaName: '',
      schemaSku: '',
      schemaMpn: '',
      schemaBrand: '',
      visibleSku: '',
      visibleMpn: '',
      error: `HTTP_${result.status}`,
    };
  }

  const html = result.text;
  const schema = extractProductSchema(html);

  const rawTitleMatch = html.match(
    /<title\b[^>]*>([\s\S]*?)<\/title>/i
  );

  return {
    ok: true,
    status: result.status,
    oldUrl,
    finalUrl: result.finalUrl,
    title:
      getMetaContent(html, 'og:title') ||
      (rawTitleMatch?.[1]
        ? stripHtml(rawTitleMatch[1])
        : ''),
    h1: getFirstHeading(html),
    schemaName: String(schema?.name || '').trim(),
    schemaSku: String(schema?.sku || '').trim(),
    schemaMpn: String(schema?.mpn || '').trim(),
    schemaBrand: schemaBrandValue(schema?.brand),
    visibleSku: extractVisibleIdentifier(html, [
      'SKU',
      'Product SKU',
    ]),
    visibleMpn: extractVisibleIdentifier(html, [
      'MPN',
      'Manufacturer Part Number',
      'Part Number',
      'Model Number',
    ]),
    error: null,
  };
}

function getOldIdentifierCandidates(
  page: OldPageData
): string[] {
  return Array.from(
    new Set(
      [
        page.schemaMpn,
        page.visibleMpn,
        page.schemaSku,
        page.visibleSku,
      ]
        .map((value) => normalizePartNumber(value))
        .filter((value) => isUsefulPartNumber(value))
    )
  );
}

function getOldNameCandidates(
  oldSlug: string,
  page: OldPageData
): string[] {
  return Array.from(
    new Set(
      [
        page.schemaName,
        page.h1,
        page.title,
        oldSlug,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function scoreCandidate(
  oldSlug: string,
  page: OldPageData,
  product: ProductRow
): MatchCandidate {
  let score = 0;
  const reasons: string[] = [];

  const productPart = normalizePartNumber(product.part_number);
  const productModel = normalizePartNumber(product.model_number);
  const productSku = normalizePartNumber(product.sku);
  const productBrand = normalizeBrand(product.brand);
  const ebayItemId = String(product.ebay_item_id || '').trim();

  const oldIdentifiers = getOldIdentifierCandidates(page);
  const oldNames = getOldNameCandidates(oldSlug, page);

  const oldBrand = normalizeBrand(page.schemaBrand);

  const oldCompactCombined = normalizeCompact(
    [
      oldSlug,
      page.schemaName,
      page.h1,
      page.title,
      page.schemaMpn,
      page.schemaSku,
      page.visibleMpn,
      page.visibleSku,
    ].join(' ')
  );

  const identifierMatch = oldIdentifiers.find(
    (identifier) =>
      identifier === productPart ||
      identifier === productModel ||
      identifier === productSku
  );

  if (identifierMatch) {
    if (
      identifierMatch === productPart &&
      isUsefulPartNumber(productPart)
    ) {
      score += 1200;
      reasons.push('old_page_identifier_exact_part_number');
    } else if (
      identifierMatch === productModel &&
      isUsefulPartNumber(productModel)
    ) {
      score += 1000;
      reasons.push('old_page_identifier_exact_model_number');
    } else if (
      identifierMatch === productSku &&
      isUsefulPartNumber(productSku)
    ) {
      score += 800;
      reasons.push('old_page_identifier_exact_sku');
    }
  }

  if (
    ebayItemId &&
    oldCompactCombined.includes(normalizeCompact(ebayItemId))
  ) {
    score += 1400;
    reasons.push('ebay_item_id_found_in_old_page_or_url');
  }

  if (
    oldBrand &&
    productBrand &&
    oldBrand === productBrand
  ) {
    score += 260;
    reasons.push('old_schema_brand_exact_match');
  } else if (
    productBrand.length >= 3 &&
    oldCompactCombined.includes(productBrand)
  ) {
    score += 120;
    reasons.push('brand_found_in_old_page');
  }

  const titleSimilarity = Math.max(
    ...oldNames.map((oldName) =>
      Math.max(
        similarity(oldName, product.name),
        similarity(oldName, product.slug)
      )
    )
  );

  if (titleSimilarity >= 0.95) {
    score += 600;
    reasons.push('old_page_title_similarity_95_plus');
  } else if (titleSimilarity >= 0.88) {
    score += 450;
    reasons.push('old_page_title_similarity_88_plus');
  } else if (titleSimilarity >= 0.78) {
    score += 300;
    reasons.push('old_page_title_similarity_78_plus');
  } else if (titleSimilarity >= 0.68) {
    score += 160;
    reasons.push('old_page_title_similarity_68_plus');
  } else if (titleSimilarity >= 0.58) {
    score += 80;
    reasons.push('old_page_title_similarity_58_plus');
  }

  if (
    isUsefulPartNumber(productPart) &&
    oldCompactCombined.includes(normalizeCompact(productPart))
  ) {
    score += 500;
    reasons.push('new_part_number_found_in_old_page');
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

function sameLogicalProduct(
  a: MatchCandidate,
  b: MatchCandidate
): boolean {
  const aPart = normalizePartNumber(a.product.part_number);
  const bPart = normalizePartNumber(b.product.part_number);

  const aBrand = normalizeBrand(a.product.brand);
  const bBrand = normalizeBrand(b.product.brand);

  if (
    !isUsefulPartNumber(aPart) ||
    !isUsefulPartNumber(bPart)
  ) {
    return false;
  }

  return (
    aPart === bPart &&
    aBrand === bBrand &&
    similarity(a.product.name, b.product.name) >= 0.85
  );
}

function classifyCandidates(
  candidates: MatchCandidate[]
): {
  level: Exclude<MatchLevel, 'OLD_PAGE_FETCH_FAILED'>;
  best: MatchCandidate | null;
  review: MatchCandidate[];
  scoreGap: number | null;
  equivalentTopCandidates: number;
} {
  const sorted = [...candidates]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.titleSimilarity - a.titleSimilarity;
    });

  if (!sorted.length) {
    return {
      level: 'NO_MATCH',
      best: null,
      review: [],
      scoreGap: null,
      equivalentTopCandidates: 0,
    };
  }

  const best = sorted[0];
  const second = sorted[1] || null;

  const equivalentTopCandidates = sorted.filter(
    (candidate) =>
      candidate.score === best.score &&
      sameLogicalProduct(best, candidate)
  ).length;

  const rawScoreGap = second
    ? best.score - second.score
    : best.score;

  const scoreGap =
    rawScoreGap === 0 &&
    second &&
    sameLogicalProduct(best, second)
      ? 999
      : rawScoreGap;

  const hasExactPageIdentifier =
    best.reasons.includes(
      'old_page_identifier_exact_part_number'
    ) ||
    best.reasons.includes(
      'old_page_identifier_exact_model_number'
    );

  const hasEbayId = best.reasons.includes(
    'ebay_item_id_found_in_old_page_or_url'
  );

  const hasExactBrand = best.reasons.includes(
    'old_schema_brand_exact_match'
  );

  if (
    hasEbayId &&
    best.score >= 1400 &&
    scoreGap >= 250
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

  // Exact old-page identifier + exact schema brand.
  if (
    hasExactPageIdentifier &&
    hasExactBrand &&
    best.score >= 1400 &&
    scoreGap >= 200
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

  // Near-identical old page title/H1/schema name with a clearly unique winner.
  if (
    best.titleSimilarity >= 0.95 &&
    best.score >= 900 &&
    scoreGap >= 300
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

  // Useful exact part/model identifier + brand signal + strong title similarity.
  if (
    hasExactPageIdentifier &&
    (
      hasExactBrand ||
      best.reasons.includes('brand_found_in_old_page')
    ) &&
    best.titleSimilarity >= 0.75 &&
    best.score >= 900 &&
    scoreGap >= 250
  ) {
    return {
      level: 'EXACT_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

 // Part number appears in the old page, brand appears too, and title is strong.
if (
  best.reasons.includes('new_part_number_found_in_old_page') &&
  best.reasons.includes('brand_found_in_old_page') &&
  best.titleSimilarity >= 0.75 &&
  best.score >= 900 &&
  scoreGap >= 250
) {
  return {
    level: 'EXACT_MATCH',
    best,
    review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
    scoreGap,
    equivalentTopCandidates,
  };
}

/*
 * Very high-confidence match with a smaller score gap.
 */
if (
  best.reasons.includes('new_part_number_found_in_old_page') &&
  (
    hasExactBrand ||
    best.reasons.includes('brand_found_in_old_page')
  ) &&
  best.titleSimilarity >= 0.95 &&
  best.score >= 1200 &&
  scoreGap >= 100
) {
  return {
    level: 'STRONG_MATCH',
    best,
    review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
    scoreGap,
    equivalentTopCandidates,
  };
}

if (
  hasExactPageIdentifier &&
  best.score >= 1200 &&
  scoreGap >= 180
) {
  return {
    level: 'STRONG_MATCH',
    best,
    review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
    scoreGap,
    equivalentTopCandidates,
  };
}

  if (
    best.score >= 850 &&
    best.titleSimilarity >= 0.78 &&
    scoreGap >= 150
  ) {
    return {
      level: 'STRONG_MATCH',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

  if (best.score >= 250) {
    return {
      level: 'REVIEW',
      best,
      review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
      scoreGap,
      equivalentTopCandidates,
    };
  }

  return {
    level: 'NO_MATCH',
    best: null,
    review: sorted.slice(0, MAX_REVIEW_CANDIDATES),
    scoreGap,
    equivalentTopCandidates,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const offset = Math.max(
      0,
      Number(url.searchParams.get('offset') || 0)
    );

    const [oldProductUrls, products] = await Promise.all([
      discoverOldProductUrls(),
      fetchAllProducts(),
    ]);

    const oldUrlBatch = oldProductUrls.slice(
      offset,
      offset + OLD_URL_BATCH
    );

    let exactMatches = 0;
    let strongMatches = 0;
    let reviewMatches = 0;
    let noMatches = 0;
    let oldPageFetchFailed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const oldUrl of oldUrlBatch) {
      const oldSlug = getOldSlug(oldUrl);
      const page = await fetchOldPageData(oldUrl);

      if (!page.ok) {
        oldPageFetchFailed++;

        results.push({
          oldUrl,
          oldSlug,
          matchLevel: 'OLD_PAGE_FETCH_FAILED',
          oldPageStatus: page.status,
          oldPageError: page.error,
        });

        continue;
      }

      const oldIdentifiers = getOldIdentifierCandidates(page);
      const candidateMap = new Map<string, ProductRow>();

      for (const product of products) {
        const productIdentifiers = [
          product.part_number,
          product.model_number,
          product.sku,
        ]
          .map((value) => normalizePartNumber(value))
          .filter((value) => isUsefulPartNumber(value));

        if (
          oldIdentifiers.some((oldIdentifier) =>
            productIdentifiers.includes(oldIdentifier)
          )
        ) {
          candidateMap.set(String(product.id), product);
        }
      }

      if (candidateMap.size < 30) {
        const oldNames = getOldNameCandidates(oldSlug, page);

        for (const product of products) {
          if (candidateMap.has(String(product.id))) {
            continue;
          }

          const quickSimilarity = Math.max(
            ...oldNames.map((oldName) =>
              Math.max(
                similarity(oldName, product.name),
                similarity(oldName, product.slug)
              )
            )
          );

          if (quickSimilarity >= 0.55) {
            candidateMap.set(String(product.id), product);
          }
        }
      }

      const candidates = Array.from(
        candidateMap.values()
      ).map((product) =>
        scoreCandidate(oldSlug, page, product)
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
        oldPage: {
          status: page.status,
          finalUrl: page.finalUrl,
          title: page.title,
          h1: page.h1,
          schemaName: page.schemaName,
          schemaSku: page.schemaSku,
          schemaMpn: page.schemaMpn,
          schemaBrand: page.schemaBrand,
          visibleSku: page.visibleSku,
          visibleMpn: page.visibleMpn,
          identifierCandidates: oldIdentifiers,
        },
        matchLevel: classification.level,
        score: best?.score ?? 0,
        scoreGap: classification.scoreGap,
        equivalentTopCandidates:
          classification.equivalentTopCandidates,
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
        modelNumber:
          best?.product.model_number ?? null,
        sku: best?.product.sku ?? null,
        productName: best?.product.name ?? null,
        newUrl: best
          ? getNewUrl(best.product)
          : null,
        reviewCandidates:
          classification.level === 'REVIEW'
            ? classification.review.map((candidate) => ({
                productId: candidate.product.id,
                ebayItemId:
                  candidate.product.ebay_item_id,
                brand: candidate.product.brand,
                partNumber:
                  candidate.product.part_number,
                modelNumber:
                  candidate.product.model_number,
                sku: candidate.product.sku,
                productName:
                  candidate.product.name,
                newUrl: getNewUrl(candidate.product),
                score: candidate.score,
                titleSimilarity: Number(
                  candidate.titleSimilarity.toFixed(4)
                ),
                reasons: candidate.reasons,
              }))
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
      oldPageFetchFailed,
      matchedSafeTotal:
        exactMatches + strongMatches,
      nextOffset:
        offset + oldUrlBatch.length <
        oldProductUrls.length
          ? offset + oldUrlBatch.length
          : null,
      rules: {
        priority: [
          'old page eBay item id',
          'old page Product schema MPN',
          'old page Product schema SKU',
          'visible old page MPN / Part Number',
          'schema brand exact match',
          'old page title / H1 / schema name similarity',
          'old slug as fallback only',
        ],
        exactMatch: [
          'eBay item id with a strong unique score gap',
          'exact old-page identifier + exact schema brand',
          'title similarity >= 0.95 with score >= 900 and gap >= 300',
          'useful part/model identifier + brand signal + title similarity >= 0.75 with gap >= 250',
          'part number found in old page + brand signal + title similarity >= 0.75 with gap >= 250',
        ],
        batchSize: OLD_URL_BATCH,
        writeMode: false,
        redirectMode: false,
      },
      results,
    });
  } catch (error) {
    console.error(
      'MIGRATION MATCHER V4 ERROR:',
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
