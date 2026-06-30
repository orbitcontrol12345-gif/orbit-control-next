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

    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('ebay_feed_snapshot')
      .select('ebay_item_id, price, currency, quantity')
      .order('ebay_item_id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (snapshotError) throw snapshotError;

    if (!snapshotRows?.length) {
      return NextResponse.json({
        success: true,
        offset,
        processed: 0,
        queued: 0,
        nextOffset: null,
        message: 'No more snapshot rows',
      });
    }

    const ids = snapshotRows.map((x) => x.ebay_item_id);

    const { data: existingProducts, error: productsError } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id')
      .in('ebay_item_id', ids);

    if (productsError) throw productsError;

    const existingSet = new Set(
      (existingProducts || []).map((x) => String(x.ebay_item_id))
    );

    const newRows = snapshotRows.filter(
      (row) => !existingSet.has(String(row.ebay_item_id))
    );

    let queued = 0;

    if (newRows.length) {
      const queueRows = newRows.map((row) => ({
        ebay_item_id: row.ebay_item_id,
        status: 'pending',
        source: 'sync-engine',
        price: row.price ?? null,
        currency: row.currency || 'USD',
        quantity: row.quantity ?? 0,
        attempts: 0,
        updated_at: now,
      }));

      const { error: queueError } = await supabaseAdmin
        .from('ebay_import_queue')
        .upsert(queueRows, { onConflict: 'ebay_item_id' });

      if (queueError) throw queueError;

      queued = queueRows.length;
    }

    return NextResponse.json({
      success: true,
      offset,
      processed: snapshotRows.length,
      queued,
      nextOffset:
        snapshotRows.length === BATCH_SIZE ? offset + BATCH_SIZE : null,
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
