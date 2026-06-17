import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getImage(item: any) {
  return (
    item.image?.imageUrl ||
    item.thumbnailImages?.[0]?.imageUrl ||
    item.additionalImages?.[0]?.imageUrl ||
    '/placeholder-product.jpg'
  );
}

function getCondition(item: any) {
  const condition = item.condition || item.conditionDescription || '';
  return condition || 'Used';
}

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/\bnew without box\b/gi, '')
    .replace(/\bnew w\/o box\b/gi, '')
    .replace(/\bno box\b/gi, '')
    .replace(/\bused\b/gi, '')
    .replace(/\bfor parts\b/gi, '')
    .replace(/\bnot working\b/gi, '')
    .replace(/\bopen box\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(Number(searchParams.get('limit') || '50'), 50);
 const manualOffset = searchParams.get('offset');

let offset = Number(manualOffset || '0');

if (!manualOffset) {
  const { data: state } = await supabaseAdmin
    .from('import_state')
    .select('value')
    .eq('key', 'ebay_import_offset')
    .single();

  offset = state?.value || 2000;
}
  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q: 'Industrial Automation & Motion Controls',
    limit: String(limit),
    offset: String(offset),
    filter: 'sellers:{orbitcontrol}',
  });

  const ebayRes = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      cache: 'no-store',
    }
  );

  if (!ebayRes.ok) {
    return NextResponse.json(
      {
        success: false,
        step: 'ebay-search',
        status: ebayRes.status,
        error: await ebayRes.text(),
      },
      { status: 500 }
    );
  }

  const ebayData = await ebayRes.json();
  const items = ebayData.itemSummaries || [];

  const results = [];

  for (const item of items) {
    const ebayItemId = item.itemId;
    const listingMarketplace = item.itemLocation?.country || item.marketingPrice?.originalPrice?.currency || '';

if (item.itemWebUrl && !item.itemWebUrl.includes('ebay.com/itm/')) {
  results.push({
    ebayItemId,
    skipped: true,
    reason: 'non_us_marketplace',
    url: item.itemWebUrl,
  });
  continue;
}
    const sku = ebayItemId;

    if (!ebayItemId) continue;

    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .or(`ebay_item_id.eq.${ebayItemId},sku.eq.${sku}`)
      .maybeSingle();

    if (existing) {
      results.push({
        ebayItemId,
        skipped: true,
        reason: 'already_exists',
      });
      continue;
    }

    const title = item.title || '';
    const name = cleanTitle(title);
    const brand = item.brand || 'Unknown';

    const product = {
      sku,
      ebay_item_id: ebayItemId,
      marketplace: 'EBAY_US',
      seller: 'orbitcontrol',
      source: 'ebay',
      is_active: true,
      last_seen_at: new Date().toISOString(),

      name,
      slug: `${ebayItemId}-${slugify(name)}`,
      brand,
      category: item.categoryPath || item.categories?.[0]?.categoryName || 'Industrial Parts',
      condition: getCondition(item),
      image_url: getImage(item),
      description: title,

      part_number: sku,
    };

    const { error } = await supabaseAdmin.from('products').insert(product);

    results.push({
      ebayItemId,
      sku,
      inserted: !error,
      error: error?.message || null,
    });
  }
if (!manualOffset) {
  await supabaseAdmin
    .from('import_state')
    .update({ value: offset + limit })
    .eq('key', 'ebay_import_offset');
}
  return NextResponse.json({
    success: true,
    limit,
    offset,
    found: items.length,
    processed: results.length,
    nextOffset: offset + limit,
    results,
  });
}
