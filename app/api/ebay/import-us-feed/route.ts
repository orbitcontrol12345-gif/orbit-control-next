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
function cleanTitle(title: string, brand: string) {
  let t = String(title || '');

  t = t
    .replace(/^\s*LOT\s+\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)?\s+/i, '')
    .replace(/^\s*\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)\s+/i, '')
    .replace(/^\s*LOT\s+OF\s+\d+\s+/i, '')
    .replace(/^\s*LOT\s+/i, '')
    .replace(/\bNEW OPEN BOX\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bW\/O BOX\b/gi, '')
    .replace(/\bWITHOUT BOX\b/gi, '')
    .replace(/\bNO BOX\b/gi, '')
    .replace(/\bWITH OLD BOX\b/gi, '')
    .replace(/\bWITH FILTHY BOX\b/gi, '')
    .replace(/\bFILTHY BOX\b/gi, '')
    .replace(/\bMISSING STAND\s*&\s*BUTTON\b/gi, '')
    .replace(/\bMISSING BUTTON\b/gi, '')
    .replace(/\bMISSING STAND\b/gi, '')
    .replace(/\bNO ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT ANY ACCESSORIES\b/gi, '')
    .replace(/\bW\/O ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT ANY ACCESSORY\b/gi, '')
    .replace(/\bWITHOUT ACCESSORY\b/gi, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (brand && brand !== 'UNKNOWN') {
    const safeBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`^${safeBrand}\\s+`, 'i'), '').trim();
  }

  return t || title;
}

function cleanCondition(condition: string) {
  const c = String(condition || '').toLowerCase();

  if (c.includes('refurb')) return 'Refurbished';
  if (c.includes('open box')) return 'New – Open box';
  if (c.includes('new')) return 'New';
  if (c.includes('parts') || c.includes('not working')) return 'For parts';
  if (c.includes('used')) return 'Used';

  return condition || 'Used';
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
const cleanedTitle = cleanTitle(title, brand);
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
      name: cleanedTitle,
condition: cleanCondition(details.condition || 'Used'),
description: title,
slug: slugify(`${item.itemId}-${cleanedTitle}`),
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
