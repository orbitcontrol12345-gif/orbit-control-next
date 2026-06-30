import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_SIZE = 500;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
    const now = new Date().toISOString();

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, ebay_item_id')
      .eq('marketplace', 'EBAY_US')
      .eq('is_active', true)
      .not('ebay_item_id', 'is', null)
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (productsError) throw productsError;

    if (!products?.length) {
      return NextResponse.json({
        success: true,
        offset,
        processed: 0,
        deactivated: 0,
        nextOffset: null,
      });
    }

    const ids = products.map((p) => String(p.ebay_item_id));

    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('ebay_feed_snapshot')
      .select('ebay_item_id')
      .in('ebay_item_id', ids);

    if (snapshotError) throw snapshotError;

    const snapshotSet = new Set(
      (snapshotRows || []).map((x) => String(x.ebay_item_id))
    );

    const missingProducts = products.filter(
      (p) => !snapshotSet.has(String(p.ebay_item_id))
    );

    let deactivated = 0;

    if (missingProducts.length) {
      const missingIds = missingProducts.map((p) => p.id);

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          is_active: false,
          updated_at: now,
        })
        .in('id', missingIds);

      if (updateError) throw updateError;

      deactivated = missingIds.length;
    }

    return NextResponse.json({
      success: true,
      offset,
      processed: products.length,
      deactivated,
      nextOffset:
        products.length === BATCH_SIZE ? offset + BATCH_SIZE : null,
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
