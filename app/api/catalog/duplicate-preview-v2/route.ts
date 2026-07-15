import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'DUPLICATE-PREVIEW-V2-SAFE';
const SCAN_LIMIT = 5000;
const MAX_GROUPS = 100;

type ProductRow = {
  id: number | string;
  ebay_item_id: string | null;
  marketplace: string | null;
  brand: string | null;
  part_number: string | null;
  condition: string | null;
  name: string | null;
  r2_image_url: string | null;
  r2_gallery_urls: string[] | null;
  image_count: number | null;
  last_seen_at: string | null;
};

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
    .replace(/\s+/g, ' ');

  if (/NOT WORKING|FOR PARTS|PARTS ONLY/.test(v)) return 'NOT WORKING';
  if (/REFURBISHED/.test(v)) return 'REFURBISHED';
  if (/OPEN BOX/.test(v)) return 'OPEN BOX';
  if (/NEW WITHOUT BOX|NEW W\/O BOX|NEW NO BOX/.test(v)) {
    return 'NEW WITHOUT BOX';
  }
  if (/\bNEW\b/.test(v)) return 'NEW';
  if (/\bUSED\b/.test(v)) return 'USED';

  return v || 'UNKNOWN';
}

function isGoodPartNumber(value: unknown): boolean {
  const v = normalizePartNumber(value);

  if (!v) return false;
  if (/^\d{10,14}$/.test(v)) return false;
  if (/^(UNKNOWN|NA|NONE|N\/A)$/.test(v)) return false;
  if (/^(LOT|QTY|PCS?|PIECES?)$/i.test(v)) return false;

  return true;
}

function hasR2Images(product: ProductRow): boolean {
  return Boolean(product.r2_image_url) ||
    (Array.isArray(product.r2_gallery_urls) &&
      product.r2_gallery_urls.length > 0);
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

  score += Math.min(Number(product.image_count || 0), 10) * 10;

  return score;
}

function sortCandidates(items: ProductRow[]): ProductRow[] {
  return [...items].sort((a, b) => {
    const score = getKeepScore(b) - getKeepScore(a);
    if (score !== 0) return score;

    const aDate = new Date(a.last_seen_at || 0).getTime();
    const bDate = new Date(b.last_seen_at || 0).getTime();

    return bDate - aDate;
  });
}

function titleTokens(value: unknown): Set<string> {
  const noise = new Set([
    'NEW', 'USED', 'OPEN', 'BOX', 'REFURBISHED', 'TESTED',
    'WITH', 'WITHOUT', 'THE', 'AND', 'FOR', 'OF', 'ONLY',
    'LOT', 'QTY', 'PCS', 'PC', 'PIECE', 'PIECES',
    'UNIT', 'UNITS', 'ITEM', 'ITEMS', 'PACK', 'SET',
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

function conflictingVariants(a: ProductRow, b: ProductRow): boolean {
  const aSignals = extractVariantSignals(a.name);
  const bSignals = extractVariantSignals(b.name);

  if (!aSignals.length || !bSignals.length) return false;

  return (
    aSignals.length !== bSignals.length ||
    aSignals.some((signal) => !bSignals.includes(signal))
  );
}

function classify(
  keep: ProductRow,
  candidate: ProductRow
) {
  const similarity = titleSimilarity(keep.name, candidate.name);
  const hasConflict = conflictingVariants(keep, candidate);
  const sameMarketplace =
    String(keep.marketplace || '').toUpperCase() ===
    String(candidate.marketplace || '').toUpperCase();

  if (hasConflict) {
    return {
      level: 'NOT_SAFE_TO_DELETE',
      similarity,
      reasons: ['conflicting_variant_signals'],
    };
  }

  if (similarity >= 0.92) {
    return {
      level: 'EXACT_DUPLICATE',
      similarity,
      reasons: ['very_high_title_similarity'],
    };
  }

  if (!sameMarketplace && similarity >= 0.78) {
    return {
      level: 'PROBABLE_DUPLICATE',
      similarity,
      reasons: ['high_similarity_cross_marketplace'],
    };
  }

  if (sameMarketplace && similarity >= 0.85) {
    return {
      level: 'PROBABLE_DUPLICATE',
      similarity,
      reasons: ['high_similarity_same_marketplace'],
    };
  }

  return {
    level: 'NOT_SAFE_TO_DELETE',
    similarity,
    reasons: ['insufficient_duplicate_confidence'],
  };
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
        r2_image_url,
        r2_gallery_urls,
        image_count,
        last_seen_at
      `)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (error) throw error;

    const groups = new Map<string, ProductRow[]>();

    for (const product of (products || []) as ProductRow[]) {
      const brand = normalizeBrand(product.brand);
      const partNumber = normalizePartNumber(product.part_number);
      const condition = normalizeCondition(product.condition);

      if (!brand || brand === 'UNKNOWN') continue;
      if (!isGoodPartNumber(partNumber)) continue;

      const key = `${brand}::${partNumber}::${condition}`;
      const items = groups.get(key) || [];

      items.push(product);
      groups.set(key, items);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const sorted = sortCandidates(items);
        const keep = sorted[0];

        const candidates = sorted.slice(1).map((candidate) => {
          const result = classify(keep, candidate);

          return {
            id: candidate.id,
            ebay_item_id: candidate.ebay_item_id,
            marketplace: candidate.marketplace,
            brand: candidate.brand,
            part_number: candidate.part_number,
            condition: candidate.condition,
            name: candidate.name,
            duplicate_level: result.level,
            title_similarity: Number(result.similarity.toFixed(4)),
            reasons: result.reasons,
            variant_signals: extractVariantSignals(candidate.name),
            has_r2_images: hasR2Images(candidate),
            image_count: Number(candidate.image_count || 0),
          };
        });

        return {
          duplicate_key: key,
          normalized_brand: normalizeBrand(keep.brand),
          normalized_part_number: normalizePartNumber(keep.part_number),
          normalized_condition: normalizeCondition(keep.condition),
          total_items_in_group: sorted.length,
          marketplaces: Array.from(
            new Set(sorted.map((item) => item.marketplace || 'UNKNOWN'))
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
          },
          candidates,
        };
      });

    const exactDuplicateCandidates = duplicateGroups.reduce(
      (sum, group) =>
        sum +
        group.candidates.filter(
          (item) => item.duplicate_level === 'EXACT_DUPLICATE'
        ).length,
      0
    );

    const probableDuplicateCandidates = duplicateGroups.reduce(
      (sum, group) =>
        sum +
        group.candidates.filter(
          (item) => item.duplicate_level === 'PROBABLE_DUPLICATE'
        ).length,
      0
    );

    const unsafeCandidates = duplicateGroups.reduce(
      (sum, group) =>
        sum +
        group.candidates.filter(
          (item) => item.duplicate_level === 'NOT_SAFE_TO_DELETE'
        ).length,
      0
    );

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
      previewGroupsReturned: Math.min(
        duplicateGroups.length,
        MAX_GROUPS
      ),
      nextOffset:
        (products?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      deleteMode: false,
      groups: duplicateGroups.slice(0, MAX_GROUPS),
    });
  } catch (error) {
    console.error('DUPLICATE PREVIEW V2 ERROR:', error);

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
