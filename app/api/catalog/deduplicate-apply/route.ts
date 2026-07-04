import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function scoreProduct(row: any) {
  let score = 0;

  if (row.catalog_visible !== false) score += 20;
  if (row.is_active !== false) score += 20;
  if (row.brand && row.brand !== 'UNKNOWN') score += 20;
  if (row.part_number && row.part_number !== 'UNKNOWN') score += 20;
  if (row.image_url) score += 10;
  if (row.description) score += 5;

  return score;
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
          image_url,
          description,
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

    const groups = new Map<string, any[]>();

    for (const row of rows) {
      if (!row.catalog_key) continue;

      if (!groups.has(row.catalog_key)) {
        groups.set(row.catalog_key, []);
      }

      groups.get(row.catalog_key)!.push(row);
    }

    const duplicateGroups = Array.from(groups.entries()).filter(
      ([, items]) => items.length > 1
    );

    let hidden = 0;
    let groupsProcessed = 0;
    const sample: any[] = [];

    for (const [catalogKey, items] of duplicateGroups) {
      const sorted = [...items].sort((a, b) => {
        const scoreDiff = scoreProduct(b) - scoreProduct(a);
        if (scoreDiff !== 0) return scoreDiff;

        return Number(b.id) - Number(a.id);
      });

      const primary = sorted[0];
      const duplicates = sorted.slice(1);

      await supabaseAdmin
        .from('products')
        .update({
          catalog_visible: true,
          duplicate_of: null,
        })
        .eq('id', primary.id);

      for (const duplicate of duplicates) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            catalog_visible: false,
            duplicate_of: primary.id,
          })
          .eq('id', duplicate.id);

        if (updateError) throw updateError;

        hidden++;
      }

      groupsProcessed++;

      if (sample.length < 20) {
        sample.push({
          catalogKey,
          primary: {
            id: primary.id,
            ebay_item_id: primary.ebay_item_id,
            brand: primary.brand,
            part_number: primary.part_number,
            condition: primary.condition,
            name: primary.name,
          },
          hidden: duplicates.map((x) => ({
            id: x.id,
            ebay_item_id: x.ebay_item_id,
            brand: x.brand,
            part_number: x.part_number,
            condition: x.condition,
            name: x.name,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      groupsProcessed,
      hidden,
      sample,
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
