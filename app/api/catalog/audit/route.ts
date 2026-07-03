import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { makeCatalogKey } from '@/lib/catalog-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 20000;

function normalizeValue(value: any) {
  return String(value || '').trim().toUpperCase();
}

function isBadPartNumber(value: any) {
  const v = normalizeValue(value);
  return (
    !v ||
    v === 'UNKNOWN' ||
    /^27\d{10}$/.test(v) ||
    /^\d{12,13}$/.test(v)
  );
}

export async function GET() {
  try {
    let rows: any[] = [];
let from = 0;
const batchSize = 1000;

while (true) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      ebay_item_id,
      sku,
      brand,
      part_number,
      model_number,
      name,
      condition,
      image_url,
      marketplace,
      catalog_key,
      catalog_visible,
      duplicate_of,
      is_active,
      created_at,
      updated_at
    `)
    .eq('is_active', true)
    .range(from, from + batchSize - 1);

  if (error) throw error;

  if (!data || data.length === 0) break;

  rows.push(...data);

  if (data.length < batchSize) break;

  from += batchSize;
}

    const groups = new Map<string, any[]>();

    for (const row of rows) {
      const key =
        row.catalog_key ||
        makeCatalogKey({
          brand: row.brand,
          partNumber: row.part_number,
          name: row.name,
        });

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([catalogKey, items]) => {
        const visibleItems = items.filter((x) => x.catalog_visible !== false);

        return {
          catalogKey,
          count: items.length,
          visibleCount: visibleItems.length,
          ids: items.map((x) => x.id),
          visibleIds: visibleItems.map((x) => x.id),
          sample: items.slice(0, 5).map((x) => ({
            id: x.id,
            ebay_item_id: x.ebay_item_id,
            sku: x.sku,
            brand: x.brand,
            part_number: x.part_number,
            name: x.name,
            marketplace: x.marketplace,
            catalog_visible: x.catalog_visible,
            duplicate_of: x.duplicate_of,
          })),
        };
      })
      .sort((a, b) => b.visibleCount - a.visibleCount || b.count - a.count);

    const badPartNumbers = rows.filter((x) => isBadPartNumber(x.part_number));

    const skuAsPartNumber = rows.filter(
      (x) =>
        normalizeValue(x.sku) &&
        normalizeValue(x.sku) === normalizeValue(x.part_number)
    );

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      totalDuplicateGroups: duplicateGroups.length,
      visibleDuplicateGroups: duplicateGroups.filter((g) => g.visibleCount > 1)
        .length,
      visibleDuplicateProducts: duplicateGroups.reduce(
        (sum, g) => sum + Math.max(0, g.visibleCount - 1),
        0
      ),
      badPartNumbers: badPartNumbers.length,
      skuAsPartNumber: skuAsPartNumber.length,
      duplicateGroups: duplicateGroups.slice(0, 50),
      badPartNumberSample: badPartNumbers.slice(0, 20).map((x) => ({
        id: x.id,
        sku: x.sku,
        part_number: x.part_number,
        brand: x.brand,
        name: x.name,
      })),
      skuAsPartNumberSample: skuAsPartNumber.slice(0, 20).map((x) => ({
        id: x.id,
        sku: x.sku,
        part_number: x.part_number,
        brand: x.brand,
        name: x.name,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
