import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-27945426550787';
const LIMIT = 20;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

function getAspect(details: any, names: string[]) {
  const aspects = details?.localizedAspects || [];
  for (const name of names) {
    const found = aspects.find((a: any) => String(a.name).toLowerCase() === name.toLowerCase());
    if (found?.value) return String(found.value).trim();
  }
  return '';
}

async function getItemDetails(itemId: string, accessToken: string) {
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${itemId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept-Language': 'en-US',
    },
  });

  if (!res.ok) return null;
  return res.json();
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

  const products = [];

  for (const item of usdItems) {
    const details = await getItemDetails(item.itemId, accessToken);
    if (!details) continue;

    const title = details.title || '';
    const brand = getAspect(details, ['Brand', 'Manufacturer']) || 'UNKNOWN';
    const model =
      getAspect(details, ['MPN', 'Manufacturer Part Number', 'Model Number', 'Catalog Number', 'Model']) ||
      'UNKNOWN';

    products.push({
      ebay_item_id: item.itemId,
      sku: item.itemId,
      part_number: model,
      model_number: model,
      brand,
      category: details.categoryPath || 'Industrial Automation',
      name: title,
      condition: details.condition || 'Used',
      image_url: details.image?.imageUrl || '',
      description: title,
      slug: slugify(`${item.itemId}-${title}`),
      marketplace: 'EBAY_US',
      seller: 'orbitcontrol',
      source: 'ebay-feed',
      quantity: item.quantity,
      price: item.price,
      currency: 'USD',
      is_active: item.quantity > 0,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .upsert(products, { onConflict: 'sku' })
    .select();

  return NextResponse.json({
    success: !error,
    offset,
    nextOffset: offset + LIMIT,
    fetchedFromFeed: usdItems.length,
    imported: data?.length || 0,
    error,
    sample: products.slice(0, 3),
  });
}
