import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, ebay_item_id, brand, part_number, name')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results = (data || []).map((item) => {
    const extracted = extractPartNumber(item.name || '');

    return {
      id: item.id,
      ebay_item_id: item.ebay_item_id,
      brand: item.brand,
      current_part_number: item.part_number,
      extracted_part_number: extracted,
      changed: extracted && extracted !== item.part_number,
      name: item.name,
    };
  });

  return NextResponse.json({
    success: true,
    checked: results.length,
    changed: results.filter((x) => x.changed).length,
    results,
  });
}
