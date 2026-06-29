import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-28117945024514';
const BATCH_SIZE = 500;

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
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
      return NextResponse.json({
        success: false,
        step: 'download_feed',
        status: response.status,
        error: await response.text(),
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const fileName = Object.keys(zip.files)[0];
    const xml = await zip.files[fileName].async('string');

    const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];
    const batch = blocks.slice(offset, offset + BATCH_SIZE);

    const rows = batch
      .map((block) => {
        const ebay_item_id = getTag(block, 'ItemID');
        if (!ebay_item_id) return null;

        const priceMatch = block.match(
          /<Price currencyID="([^"]+)">([^<]+)<\/Price>/
        );

        return {
          ebay_item_id,
          sku: getTag(block, 'SKU'),
          price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
          currency: priceMatch?.[1] || 'USD',
          quantity: Number(getTag(block, 'Quantity') || 0),
          last_seen_at: now,
          feed_task_id: TASK_ID,
          raw: {
            ebay_item_id,
            sku: getTag(block, 'SKU'),
            price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
            currency: priceMatch?.[1] || 'USD',
            quantity: Number(getTag(block, 'Quantity') || 0),
          },
        };
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await supabaseAdmin
        .from('ebay_feed_snapshot')
        .upsert(rows, { onConflict: 'ebay_item_id' });

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      taskId: TASK_ID,
      fileName,
      totalItems: blocks.length,
      offset,
      processed: rows.length,
      nextOffset:
        offset + BATCH_SIZE < blocks.length ? offset + BATCH_SIZE : null,
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
