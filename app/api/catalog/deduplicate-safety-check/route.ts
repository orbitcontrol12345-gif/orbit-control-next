import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeCondition(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export async function GET() {
  try {
    const rows: any[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          ebay_item_id,
          brand,
          part_number,
          name,
          condition,
          catalog_key,
          catalog_visible,
          duplicate_of,
          is_active
        `)
        .eq('is_active', true)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);

      if (data.length < batchSize) break;
      from += batchSize;
    }

    const hidden = rows.filter((x) => x.catalog_visible === false && x.duplicate_of);
    const byPrimary = new Map<string, any[]>();

    for (const item of hidden) {
      const key = String(item.duplicate_of);
      if (!byPrimary.has(key)) byPrimary.set(key, []);
      byPrimary.get(key)!.push(item);
    }

    const warnings: any[] = [];

    for (const [primaryId, duplicates] of byPrimary.entries()) {
      const primary = rows.find((x) => String(x.id) === primaryId);
      if (!primary) continue;

      const primaryCondition = normalizeCondition(primary.condition);
      const primaryCatalogKey = String(primary.catalog_key || '');

      const differentConditions = duplicates.filter(
        (x) => normalizeCondition(x.condition) !== primaryCondition
      );

      const differentCatalogKeys = duplicates.filter(
        (x) => String(x.catalog_key || '') !== primaryCatalogKey
      );

      if (differentConditions.length > 0 || differentCatalogKeys.length > 0) {
        warnings.push({
          primary: {
            id: primary.id,
            ebay_item_id: primary.ebay_item_id,
            brand: primary.brand,
            part_number: primary.part_number,
            condition: primary.condition,
            catalog_key: primary.catalog_key,
            name: primary.name,
          },
          differentConditions: differentConditions.map((x) => ({
            id: x.id,
            ebay_item_id: x.ebay_item_id,
            brand: x.brand,
            part_number: x.part_number,
            condition: x.condition,
            catalog_key: x.catalog_key,
            name: x.name,
          })),
          differentCatalogKeys: differentCatalogKeys.map((x) => ({
            id: x.id,
            ebay_item_id: x.ebay_item_id,
            brand: x.brand,
            part_number: x.part_number,
            condition: x.condition,
            catalog_key: x.catalog_key,
            name: x.name,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      hiddenDuplicates: hidden.length,
      riskyGroups: warnings.length,
      safe: warnings.length === 0,
      sample: warnings.slice(0, 30),
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
