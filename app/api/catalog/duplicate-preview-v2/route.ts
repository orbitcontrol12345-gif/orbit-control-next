import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'DUPLICATE-PREVIEW-V3-IMAGE-SAFE';
const SCAN_LIMIT = 5000;
const MAX_GROUPS = 100;
const IMAGE_COMPARE_LIMIT = 3;

type ProductRow = {
  id: number | string;
  ebay_item_id: string | null;
  marketplace: string | null;
  brand: string | null;
  part_number: string | null;
  condition: string | null;
  name: string | null;
  image_url: string | null;
  r2_image_url: string | null;
  r2_gallery_urls: string[] | null;
  image_count: number | null;
  last_seen_at: string | null;
};

type ImageFingerprintResult = {
  url: string;
  ok: boolean;
  fingerprint: string | null;
  size: number | null;
  error?: string;
};

const MARKETPLACE_PRIORITY = [
  'EBAY_US',
  'EBAY_GB',
  'EBAY_UK',
  'EBAY_DE',
  'EBAY_AU',
  'EBAY_CA',
];

function normalizeBrand(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function normalizePartNumber(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9./-]/g, '');
}

function normalizeCondition(value: unknown): string {
  const v = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ');

  if (!v) return 'UNKNOWN';

  if (
    /\bNOT WORKING\b/.test(v) ||
    /\bFOR PARTS\b/.test(v) ||
    /\bPARTS ONLY\b/.test(v)
  ) {
    return 'NOT WORKING';
  }

  if (/\bREFURBISHED\b/.test(v)) return 'REFURBISHED';
  if (/\bOPEN BOX\b/.test(v)) return 'OPEN BOX';

  if (
    /\bNEW WITHOUT BOX\b/.test(v) ||
    /\bNEW W\/O BOX\b/.test(v) ||
    /\bNEW NO BOX\b/.test(v)
  ) {
    return 'NEW WITHOUT BOX';
  }

  if (/\bNEW\b/.test(v)) return 'NEW';
  if (/\bUSED\b/.test(v)) return 'USED';

  return v;
}

function isGoodPartNumber(value: unknown): boolean {
  const v = normalizePartNumber(value);

  if (!v) return false;
  if (/^\d{10,14}$/.test(v)) return false;
  if (/^(UNKNOWN|NA|NONE|N\/A)$/.test(v)) return false;
  if (/^(LOT|QTY|PCS?|PIECES?)$/i.test(v)) return false;

  return true;
}

function marketplaceRank(value: unknown): number {
  const marketplace = String(value || '').trim().toUpperCase();
  const index = MARKETPLACE_PRIORITY.indexOf(marketplace);

  return index === -1
    ? MARKETPLACE_PRIORITY.length + 100
    : index;
}

function getProductImages(product: ProductRow): string[] {
  const gallery = Array.isArray(product.r2_gallery_urls)
    ? product.r2_gallery_urls
    : [];

  return Array.from(
    new Set(
      [
        product.r2_image_url,
        ...gallery,
        product.image_url,
      ]
        .map((value) => String(value || '').trim())
        .filter((url) => /^https?:\/\//i.test(url))
    )
  ).slice(0, IMAGE_COMPARE_LIMIT);
}

function hasR2Images(product: ProductRow): boolean {
  return getProductImages(product).length > 0;
}

function getKeepScore(product: ProductRow): number {
  let score = 0;

  if (String(product.marketplace || '').toUpperCase() === 'EBAY_US') {
    score += 10000;
  }

  if (hasR2Images(product)) score += 3000;
  if (isGoodPartNumber(product.part_number)) score += 2000;

  const brand = normalizeBrand(product.brand);
  if (brand && brand !== 'UNKNOWN') score += 1000;

  score += Math.max(0, 100 - marketplaceRank(product.marketplace));
  score += Math.min(Number(product.image_count || 0), 10) * 10;

  return score;
}

function sortCandidates(products: ProductRow[]): ProductRow[] {
  return [...products].sort((a, b) => {
    const scoreDifference = getKeepScore(b) - getKeepScore(a);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const aLastSeen = new Date(a.last_seen_at || 0).getTime();
    const bLastSeen = new Date(b.last_seen_at || 0).getTime();

    if (bLastSeen !== aLastSeen) {
      return bLastSeen - aLastSeen;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function titleTokens(value: unknown): Set<string> {
  const noise = new Set([
    'NEW',
    'USED',
    'OPEN',
    'BOX',
    'REFURBISHED',
    'TESTED',
    'TRIED',
    'OK',
    'WITH',
    'WITHOUT',
    'THE',
    'AND',
    'FOR',
    'OF',
    'ONLY',
    'LOT',
    'QTY',
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
  ]);

  const tokens = String(value || '')
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[^A-Z0-9./-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .filter((token) => !noise.has(token));

  return new Set(tokens);
}

function titleSimilarity(a: unknown, b: unknown): number {
  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);

  if (!aTokens.size || !bTokens.size) return 0;

  let intersection = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }

  const union = new Set([
    ...Array.from(aTokens),
    ...Array.from(bTokens),
  ]).size;

  return union ? intersection / union : 0;
}

function extractVariantSignals(value: unknown): string[] {
  const text = String(value || '').toUpperCase();

  const patterns = [
    /\b\d+(?:\.\d+)?\s*(?:FEET|FOOT|FT|METER|METERS|METRE|METRES)\b/g,
    /\bREV\.?\s*[A-Z0-9.-]+\b/g,
    /\bVER(?:SION)?\.?\s*[A-Z0-9.-]+\b/g,
    /\bS\/W\s*V?[A-Z0-9.-]+\b/g,
    /\bF\/W\s*V?[A-Z0-9.-]+\b/g,
    /\bWITH\s+[A-Z0-9./-]+\b/g,
    /\bW\/\s*[A-Z0-9./-]+\b/g,
  ];

  return Array.from(
    new Set(
      patterns.flatMap((pattern) => text.match(pattern) || [])
    )
  );
}

function conflictingVariants(
  a: ProductRow,
  b: ProductRow
): boolean {
  const aSignals = extractVariantSignals(a.name);
  const bSignals = extractVariantSignals(b.name);

  if (!aSignals.length || !bSignals.length) {
    return false;
  }

  return (
    aSignals.length !== bSignals.length ||
    aSignals.some((signal) => !bSignals.includes(signal))
  );
}

async function fingerprintImage(
  url: string
): Promise<ImageFingerprintResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Orbit-Control-Duplicate-Preview',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        url,
        ok: false,
        fingerprint: null,
        size: null,
        error: `HTTP_${response.status}`,
      };
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (!contentType.startsWith('image/')) {
      return {
        url,
        ok: false,
        fingerprint: null,
        size: null,
        error: `INVALID_CONTENT_TYPE_${contentType}`,
      };
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return {
      url,
      ok: true,
      fingerprint: createHash('sha256')
        .update(buffer)
        .digest('hex'),
      size: buffer.length,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      fingerprint: null,
      size: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

async function fingerprintProduct(
  product: ProductRow
): Promise<ImageFingerprintResult[]> {
  const images = getProductImages(product);

  return Promise.all(
    images.map((url) => fingerprintImage(url))
  );
}

function compareFingerprints(
  a: ImageFingerprintResult[],
  b: ImageFingerprintResult[]
): {
  comparable: boolean;
  exactImageMatch: boolean;
  matchedCount: number;
  comparedCount: number;
} {
  const aHashes = a
    .filter((item) => item.ok && item.fingerprint)
    .map((item) => item.fingerprint as string);

  const bHashes = b
    .filter((item) => item.ok && item.fingerprint)
    .map((item) => item.fingerprint as string);

  if (!aHashes.length || !bHashes.length) {
    return {
      comparable: false,
      exactImageMatch: false,
      matchedCount: 0,
      comparedCount: 0,
    };
  }

  const comparedCount = Math.min(
    aHashes.length,
    bHashes.length
  );

  let matchedCount = 0;

  for (let i = 0; i < comparedCount; i++) {
    if (aHashes[i] === bHashes[i]) {
      matchedCount++;
    }
  }

  return {
    comparable: true,
    exactImageMatch:
      comparedCount > 0 &&
      matchedCount === comparedCount,
    matchedCount,
    comparedCount,
  };
}

function sameMarketplace(
  a: ProductRow,
  b: ProductRow
): boolean {
  return (
    String(a.marketplace || '').toUpperCase() ===
    String(b.marketplace || '').toUpperCase()
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const offset = Math.max(
      0,
      Number(url.searchParams.get('offset') || 0)
    );

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        marketplace,
        brand,
        part_number,
        condition,
        name,
        image_url,
        r2_image_url,
        r2_gallery_urls,
        image_count,
        last_seen_at
      `)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (error) {
      throw error;
    }

    const groups = new Map<string, ProductRow[]>();

    for (const product of (products || []) as ProductRow[]) {
      const brand = normalizeBrand(product.brand);
      const partNumber = normalizePartNumber(
        product.part_number
      );
      const condition = normalizeCondition(
        product.condition
      );

      if (!brand || brand === 'UNKNOWN') {
        continue;
      }

      if (!isGoodPartNumber(partNumber)) {
        continue;
      }

      const key = `${brand}::${partNumber}::${condition}`;
      const current = groups.get(key) || [];

      current.push(product);
      groups.set(key, current);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, items]) => items.length > 1);

    const previewGroups: Array<Record<string, unknown>> = [];

    let exactDuplicateCandidates = 0;
    let probableDuplicateCandidates = 0;
    let unsafeCandidates = 0;
    let imageComparedCandidates = 0;

    for (const [key, items] of duplicateGroups) {
      const sorted = sortCandidates(items);
      const keep = sorted[0];

      const keepFingerprints =
        await fingerprintProduct(keep);

      const candidates: Array<Record<string, unknown>> = [];

      for (const candidate of sorted.slice(1)) {
        const similarity = titleSimilarity(
          keep.name,
          candidate.name
        );

        const hasConflict = conflictingVariants(
          keep,
          candidate
        );

        const candidateFingerprints =
          await fingerprintProduct(candidate);

        const imageComparison = compareFingerprints(
          keepFingerprints,
          candidateFingerprints
        );

        if (imageComparison.comparable) {
          imageComparedCandidates++;
        }

        let duplicateLevel:
          | 'EXACT_DUPLICATE'
          | 'PROBABLE_DUPLICATE'
          | 'NOT_SAFE_TO_DELETE';

        const reasons: string[] = [];

        if (hasConflict) {
          duplicateLevel = 'NOT_SAFE_TO_DELETE';
          reasons.push('conflicting_variant_signals');
        } else if (
          similarity >= 0.92 &&
          imageComparison.exactImageMatch
        ) {
          duplicateLevel = 'EXACT_DUPLICATE';
          reasons.push(
            'very_high_title_similarity',
            'exact_image_fingerprint_match'
          );
        } else if (
          similarity >= 0.92 &&
          imageComparison.comparable &&
          !imageComparison.exactImageMatch
        ) {
          duplicateLevel = 'NOT_SAFE_TO_DELETE';
          reasons.push(
            'same_title_but_different_images'
          );
        } else if (
          similarity >= 0.85 &&
          imageComparison.exactImageMatch
        ) {
          duplicateLevel = 'PROBABLE_DUPLICATE';
          reasons.push(
            'high_title_similarity',
            'exact_image_fingerprint_match'
          );
        } else if (
          !sameMarketplace(keep, candidate) &&
          similarity >= 0.78 &&
          imageComparison.exactImageMatch
        ) {
          duplicateLevel = 'PROBABLE_DUPLICATE';
          reasons.push(
            'cross_marketplace_high_similarity',
            'exact_image_fingerprint_match'
          );
        } else {
          duplicateLevel = 'NOT_SAFE_TO_DELETE';
          reasons.push(
            imageComparison.comparable
              ? 'insufficient_duplicate_confidence'
              : 'images_not_comparable'
          );
        }

        if (duplicateLevel === 'EXACT_DUPLICATE') {
          exactDuplicateCandidates++;
        } else if (
          duplicateLevel === 'PROBABLE_DUPLICATE'
        ) {
          probableDuplicateCandidates++;
        } else {
          unsafeCandidates++;
        }

        candidates.push({
          id: candidate.id,
          ebay_item_id: candidate.ebay_item_id,
          marketplace: candidate.marketplace,
          brand: candidate.brand,
          part_number: candidate.part_number,
          condition: candidate.condition,
          name: candidate.name,
          duplicate_level: duplicateLevel,
          title_similarity: Number(
            similarity.toFixed(4)
          ),
          reasons,
          variant_signals: extractVariantSignals(
            candidate.name
          ),
          image_comparison: imageComparison,
          candidate_image_fingerprints:
            candidateFingerprints.map((item) => ({
              ok: item.ok,
              size: item.size,
              fingerprint: item.fingerprint,
              error: item.error,
            })),
          has_r2_images: hasR2Images(candidate),
          image_count: Number(candidate.image_count || 0),
        });
      }

      previewGroups.push({
        duplicate_key: key,
        normalized_brand: normalizeBrand(keep.brand),
        normalized_part_number: normalizePartNumber(
          keep.part_number
        ),
        normalized_condition: normalizeCondition(
          keep.condition
        ),
        total_items_in_group: sorted.length,
        marketplaces: Array.from(
          new Set(
            sorted.map(
              (item) =>
                String(item.marketplace || 'UNKNOWN')
            )
          )
        ),
        keep: {
          id: keep.id,
          ebay_item_id: keep.ebay_item_id,
          marketplace: keep.marketplace,
          brand: keep.brand,
          part_number: keep.part_number,
          condition: keep.condition,
          name: keep.name,
          variant_signals: extractVariantSignals(keep.name),
          has_r2_images: hasR2Images(keep),
          image_count: Number(keep.image_count || 0),
          keep_score: getKeepScore(keep),
          image_fingerprints: keepFingerprints.map(
            (item) => ({
              ok: item.ok,
              size: item.size,
              fingerprint: item.fingerprint,
              error: item.error,
            })
          ),
        },
        candidates,
      });

      if (previewGroups.length >= MAX_GROUPS) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      mode: 'preview-only-no-delete',
      offset,
      scanned: products?.length ?? 0,
      scanLimit: SCAN_LIMIT,
      groupsFound: duplicateGroups.length,
      exactDuplicateCandidates,
      probableDuplicateCandidates,
      unsafeCandidates,
      imageComparedCandidates,
      previewGroupsReturned: previewGroups.length,
      nextOffset:
        (products?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      rules: {
        exactDuplicate: [
          'same normalized brand',
          'same normalized part number',
          'same normalized condition',
          'title similarity >= 0.92',
          'no conflicting variant signals',
          'exact SHA-256 match on compared product images',
        ],
        probableDuplicate: [
          'high title similarity',
          'exact SHA-256 match on compared product images',
        ],
        unsafeWhen: [
          'same title but different image fingerprints',
          'conflicting revision/version/accessory signals',
          'images cannot be compared',
          'insufficient title similarity',
        ],
        imageCompareLimit: IMAGE_COMPARE_LIMIT,
        deleteMode: false,
      },
      groups: previewGroups,
    });
  } catch (error) {
    console.error(
      'DUPLICATE PREVIEW V3 ERROR:',
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
