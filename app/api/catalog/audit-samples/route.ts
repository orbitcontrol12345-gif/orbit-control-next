import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        brand,
        part_number,
        condition,
        name,
        catalog_key,
        catalog_visible,
        is_active
      `)
      .eq('is_active', true)
      .eq('catalog_visible', true)
      .order('brand')
      .order('part_number');

    if (error) throw error;

    const groups = new Map<string, any[]>();

    for (const row of rows || []) {
      const key = row.catalog_key || `${row.brand || ''}|${row.part_number || ''}|${row.condition || ''}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(row);
    }

    const duplicates: any[] = [];

    for (const [key, items] of groups.entries()) {
      if (items.length <= 1) continue;

      duplicates.push({
        key,
        total: items.length,
        conditions: [...new Set(items.map(x => x.condition))],
        catalogKeys: [...new Set(items.map(x => x.catalog_key))],
        items: items.map(x => ({
          id: x.id,
          ebayItemId: x.ebay_item_id,
          brand: x.brand,
          partNumber: x.part_number,
          condition: x.condition,
          catalogKey: x.catalog_key,
          name: x.name,
        })),
      });
    }

    duplicates.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      duplicateGroups: duplicates.length,
      sample: duplicates.slice(0, 20),
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
