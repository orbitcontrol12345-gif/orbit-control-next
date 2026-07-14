import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE_PRIORITY = [
  'EBAY_US',
  'EBAY_GB',
  'EBAY_UK',
  'EBAY_DE',
  'EBAY_AU',
  'EBAY_CA',
];

const MAX_GROUPS = 100;
const SCAN_LIMIT = 5000;

function normalizeBrand(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
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

  if (!v) return 'UNKNOWN';

  if (/\bNOT WORKING\b|\bFOR PARTS\b|\bPARTS ONLY\b/.test(v)) {
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

function hasR2Images(product: any): boolean {
  const gallery = Array.isArray(product.r2_gallery_urls)
    ? product.r2_gallery_urls
    : [];

  return Boolean(product.r2_image_url) || gallery.length > 0;
}

function marketplaceRank(value: unknown): number {
  const marketplace = String(value || '').trim().toUpperCase();
  const index = MARKETPLACE_PRIORITY.indexOf(marketplace);

  return index === -1
    ? MARKETPLACE_PRIORITY.length + 100
    : index;
}

function getKeepScore(product: any): number {
  let score = 0;

  if (String(product.marketplace || '').toUpperCase() === 'EBAY_US') {
    score += 10000;
  }

  if (hasR2Images(product)) score += 3000;
  if (isGoodPartNumber(product.part_number)) score += 2000;

  const brand = String(product.brand || '').trim().toUpperCase();

  if (brand && brand !== 'UNKNOWN') score += 1000;

  score += Math.max(0, 100 - marketplaceRank(product.marketplace));

  const imageCount = Number(product.image_count || 0);

  if (Number.isFinite(imageCount)) {
    score += Math.min(imageCount, 10) * 10;
  }

  return score;
}

function sortCandidates(products: any[]): any[] {
  return [...products].sort((a, b) => {
    const scoreDifference = getKeepScore(b) - getKeepScore(a);

    if (scoreDifference !== 0) return scoreDifference;

    const aLastSeen = new Date(a.last_seen_at || 0).getTime();
    const bLastSeen = new Date(b.last_seen_at || 0).getTime();

    if (bLastSeen !== aLastSeen) return bLastSeen - aLastSeen;

    return String(a.id).localeCompare(String(b.id));
  });
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
        last_seen_at,
        is_active
      `)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (error) throw error;

    const groups = new Map<string, any[]>();

    for (const product of products || []) {
      const brand = normalizeBrand(product.brand);
      const partNumber = normalizePartNumber(product.part_number);
      const condition = normalizeCondition(product.condition);

      if (!brand || brand === 'UNKNOWN') continue;
      if (!isGoodPartNumber(partNumber)) continue;

      const key = `${brand}::${partNumber}::${condition}`;

      const current = groups.get(key) || [];
      current.push(product);
      groups.set(key, current);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const sorted = sortCandidates(items);
        const keep = sorted[0];
        const duplicateCandidates = sorted.slice(1);

        return {
          duplicate_key: key,
          normalized_brand: normalizeBrand(keep.brand),
          normalized_part_number: normalizePartNumber(
            keep.part_number
          ),
          normalized_condition: normalizeCondition(
            keep.condition
          ),
          duplicate_count: sorted.length,
          marketplaces: Array.from(
            new Set(
              sorted.map((item) =>
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
            has_r2_images: hasR2Images(keep),
            image_count: Number(keep.image_count || 0),
            keep_score: getKeepScore(keep),
            last_seen_at: keep.last_seen_at,
          },
          duplicate_candidates: duplicateCandidates.map(
            (item) => ({
              id: item.id,
              ebay_item_id: item.ebay_item_id,
              marketplace: item.marketplace,
              brand: item.brand,
              part_number: item.part_number,
              condition: item.condition,
              name: item.name,
              has_r2_images: hasR2Images(item),
              image_count: Number(item.image_count || 0),
              keep_score: getKeepScore(item),
              last_seen_at: item.last_seen_at,
            })
          ),
        };
      })
      .sort((a, b) => {
        if (b.duplicate_count !== a.duplicate_count) {
          return b.duplicate_count - a.duplicate_count;
        }

        return a.normalized_part_number.localeCompare(
          b.normalized_part_number
        );
      });

    const preview = duplicateGroups.slice(0, MAX_GROUPS);

    const duplicateProductCount = duplicateGroups.reduce(
      (sum, group) => sum + group.duplicate_count - 1,
      0
    );

    return NextResponse.json({
      success: true,
      mode: 'preview-only-no-delete',
      offset,
      scanned: products?.length ?? 0,
      scanLimit: SCAN_LIMIT,
      duplicateGroupsFound: duplicateGroups.length,
      duplicateProductsFound: duplicateProductCount,
      previewGroupsReturned: preview.length,
      nextOffset:
        (products?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      rules: {
        groupBy: [
          'normalized_brand',
          'normalized_part_number',
          'normalized_condition',
        ],
        keepPriority: [
          'EBAY_US',
          'has R2 images',
          'valid part number',
          'valid brand',
          'marketplace priority',
          'image count',
          'latest last_seen_at',
        ],
        deleteMode: false,
      },
      groups: preview,
    });
  } catch (error) {
    console.error('DUPLICATE PREVIEW ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
