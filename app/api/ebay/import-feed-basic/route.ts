import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-27945426550787';
const LIMIT = 500;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

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

  const buffer = Buffer.from(await feedRes.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files)[0];
  const xml = await zip.files[fileName].async('string');

  const blocks = Array.from(xml.matchAll(/<SKUDetails>([\s\S]*?)<\/SKUDetails>/g));

  const usdItems = blocks
    .map((m) => {
      const block = m[1];
      const itemId = block.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] || '';
      const quantity = Number(block.match(/<Quantity>(.*?)<\/Quantity>/)?.[1] || 0);
      const priceMatch = block.match(/<Price currencyID="(.*?)">(.*?)<\/Price>/);
      const currency = priceMatch?.[1] || '';
      const price = Number(priceMatch?.[2] || 0);

      return { itemId, quantity, currency, price };
    })
    .filter((x) => x.currency === 'USD' && x.itemId)
    .slice(offset, offset + LIMIT);

  const now = new Date().toISOString();

  const products = usdItems.map((item) => ({
    ebay_item_id: item.itemId,
    sku: item.itemId,
    part_number: item.itemId,
    model_number: item.itemId,
    brand: 'UNKNOWN',
    category: 'Industrial Automation',
    name: `Orbit Control Industrial Item ${item.itemId}`,
    condition: 'Used',
    image_url: '',
    description: `Imported from eBay active inventory feed. Item ID: ${item.itemId}`,
    slug: slugify(`${item.itemId}-orbit-control-industrial-item`),
    marketplace: 'EBAY_US',
    seller: 'orbitcontrol',
    source: 'ebay-feed-basic',
    source_type: 'ebay',
    quantity: item.quantity,
    price: item.price,
    currency: 'USD',
    is_active: item.quantity > 0,
    last_seen_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabaseAdmin
    .from('products')
    .upsert(products, { onConflict: 'sku' })
    .select('id, sku');

  return NextResponse.json({
    success: !error,
    offset,
    nextOffset: offset + LIMIT,
    fetched: usdItems.length,
    prepared: products.length,
    imported: data?.length || 0,
    error,
    sample: products.slice(0, 3),
  });
}
