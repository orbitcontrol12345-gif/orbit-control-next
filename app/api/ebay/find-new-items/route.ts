import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 100;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);

    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('ebay_feed_snapshot')
      .select('ebay_item_id')
      .order('ebay_item_id')
      .range(offset, offset + LIMIT - 1);

    if (snapshotError) throw snapshotError;

    if (!snapshotRows?.length) {
      return NextResponse.json({
        success: true,
        offset,
        checked: 0,
        newItems: 0,
        items: [],
        nextOffset: null,
      });
    }

    const ids = snapshotRows.map((x) => String(x.ebay_item_id));

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id')
      .in('ebay_item_id', ids);

    if (productsError) throw productsError;

    const existingSet = new Set(
      (products || []).map((x) => String(x.ebay_item_id))
    );

    const newItems = ids.filter((id) => !existingSet.has(id));

    return NextResponse.json({
      success: true,
      offset,
      checked: ids.length,
      newItems: newItems.length,
      items: newItems.slice(0, 20),
      nextOffset: snapshotRows.length === LIMIT ? offset + LIMIT : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
