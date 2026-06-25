import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 1000;

export async function GET() {
  const stateRes = await supabaseAdmin
    .from('ebay_sync_state')
    .select('*')
    .eq('id', 'active_inventory')
    .single();

  const state = stateRes.data;

  if (!state?.task_id) {
    return NextResponse.json({
      success: false,
      message: 'No active task_id found. Run /api/ebay/sync-start first.',
    });
  }

  const offset = Number(state.offset_value || 0);

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const feedRes = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${state.task_id}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!feedRes.ok) {
    return NextResponse.json({
      success: false,
      status: feedRes.status,
      message: 'Feed not ready yet or failed.',
      error: await feedRes.text(),
    });
  }

  const buffer = Buffer.from(await feedRes.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files)[0];
  const xml = await zip.files[fileName].async('string');

  const blocks = Array.from(xml.matchAll(/<SKUDetails>([\s\S]*?)<\/SKUDetails>/g));

  const rows = blocks
    .map((m) => {
      const block = m[1];

      const itemId = block.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] || '';
      const quantity = Number(block.match(/<Quantity>(.*?)<\/Quantity>/)?.[1] || 0);
      const priceMatch = block.match(/<Price currencyID="(.*?)">(.*?)<\/Price>/);
      const currency = priceMatch?.[1] || '';

      return {
        ebay_item_id: itemId,
        status: quantity > 0 && currency === 'USD' ? 'pending' : 'skip',
      };
    })
    .filter((x) => x.ebay_item_id)
    .slice(offset, offset + LIMIT);

  if (rows.length === 0) {
    await supabaseAdmin
      .from('ebay_sync_state')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'active_inventory');

    return NextResponse.json({
      success: true,
      message: 'Feed completed. No more rows.',
      offset,
      prepared: 0,
    });
  }

  const { data, error } = await supabaseAdmin
    .from('ebay_import_queue')
    .upsert(rows, { onConflict: 'ebay_item_id' })
    .select('ebay_item_id');

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  await supabaseAdmin
    .from('ebay_sync_state')
    .update({
      status: 'processing_feed',
      offset_value: offset + LIMIT,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'active_inventory');

  return NextResponse.json({
    success: true,
    taskId: state.task_id,
    offset,
    nextOffset: offset + LIMIT,
    prepared: rows.length,
    importedToQueue: data?.length || 0,
    sample: rows.slice(0, 5),
  });
}
