import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-28117945024514';

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

function parseInventoryXml(xml: string) {
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  return blocks
    .map((block) => {
      const ebay_item_id = getTag(block, 'ItemID');
      const sku = getTag(block, 'SKU');
      const quantity = Number(getTag(block, 'Quantity') || 0);

      const priceMatch = block.match(/<Price currencyID="([^"]+)">([^<]+)<\/Price>/);
      const currency = priceMatch?.[1] || 'USD';
      const price = priceMatch?.[2] ? Number(priceMatch[2]) : null;

      if (!ebay_item_id) return null;

      return {
        ebay_item_id,
        sku,
        price,
        currency,
        quantity,
      };
    })
    .filter(Boolean) as {
      ebay_item_id: string;
      sku: string | null;
      price: number | null;
      currency: string;
      quantity: number;
    }[];
}

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { access_token } = await getEbayToken();

    const response = await fetch(
      `https://api.ebay.com/sell/feed/v1/task/${TASK_ID}/download_result_file`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Accept-Language': 'en-US',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({
        success: false,
        step: 'download_feed',
        status: response.status,
        error,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const fileName = Object.keys(zip.files)[0];
    const xml = await zip.files[fileName].async('string');

    const feedItems = parseInventoryXml(xml);
    const feedIds = feedItems.map((x) => x.ebay_item_id);

    let snapshotUpserted = 0;
    let existingUpdated = 0;
    let queuedNew = 0;

    for (const item of feedItems) {
      await supabaseAdmin.from('ebay_feed_snapshot').upsert(
        {
          ebay_item_id: item.ebay_item_id,
          sku: item.sku,
          price: item.price,
          currency: item.currency,
          quantity: item.quantity,
          last_seen_at: now,
          feed_task_id: TASK_ID,
          raw: item,
        },
        { onConflict: 'ebay_item_id' }
      );

      snapshotUpserted++;
    }

    const { data: existingProducts, error: existingError } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id')
      .not('ebay_item_id', 'is', null);

    if (existingError) throw existingError;

    const existingSet = new Set(
      (existingProducts || []).map((p) => String(p.ebay_item_id))
    );

    const newIds = feedIds.filter((id) => !existingSet.has(id));

    for (const ebayItemId of newIds) {
      const item = feedItems.find((x) => x.ebay_item_id === ebayItemId);

      await supabaseAdmin.from('ebay_import_queue').upsert(
        {
          ebay_item_id: ebayItemId,
          status: 'pending',
          source: 'sync-engine',
          price: item?.price ?? null,
          currency: item?.currency ?? 'USD',
          quantity: item?.quantity ?? 0,
          updated_at: now,
        },
        { onConflict: 'ebay_item_id' }
      );

      queuedNew++;
    }

    const existingIdsInFeed = feedIds.filter((id) => existingSet.has(id));

    for (const ebayItemId of existingIdsInFeed) {
      const item = feedItems.find((x) => x.ebay_item_id === ebayItemId);

      await supabaseAdmin
        .from('products')
        .update({
          last_seen_at: now,
          updated_at: now,
          is_active: true,
          price: item?.price ?? null,
          currency: item?.currency ?? 'USD',
          quantity: item?.quantity ?? 0,
        })
        .eq('ebay_item_id', ebayItemId);

      existingUpdated++;
    }

    const { data: activeProducts, error: activeError } = await supabaseAdmin
      .from('products')
      .select('id, ebay_item_id')
      .eq('is_active', true)
      .not('ebay_item_id', 'is', null);

    if (activeError) throw activeError;

    const feedSet = new Set(feedIds);
    const missingProducts = (activeProducts || []).filter(
      (p) => !feedSet.has(String(p.ebay_item_id))
    );

    let deactivated = 0;

    for (const product of missingProducts) {
      await supabaseAdmin
        .from('products')
        .update({
          is_active: false,
          updated_at: now,
        })
        .eq('id', product.id);

      deactivated++;
    }

    return NextResponse.json({
      success: true,
      taskId: TASK_ID,
      fileName,
      feedCount: feedItems.length,
      snapshotUpserted,
      existingUpdated,
      queuedNew,
      deactivated,
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
