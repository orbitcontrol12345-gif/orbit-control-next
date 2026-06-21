import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-27945426550787';
const LIMIT = 1000;

export async function GET(request: Request) {
  const offset = Number(new URL(request.url).searchParams.get('offset') || 0);

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const feedRes = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${TASK_ID}/download_result_file`,
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

  const { data, error } = await supabaseAdmin
    .from('ebay_import_queue')
    .upsert(rows, { onConflict: 'ebay_item_id' })
    .select('ebay_item_id');

  return NextResponse.json({
    success: !error,
    offset,
    nextOffset: offset + LIMIT,
    prepared: rows.length,
    importedToQueue: data?.length || 0,
    error,
    sample: rows.slice(0, 5),
  });
}
