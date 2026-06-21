import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 200;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

function cleanTitle(title: string) {
  return String(title || '')
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
    .replace(/\bWITHOUT ANY ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT ACCESSORIES\b/gi, '')
    .replace(/\bNO ACCESSORIES\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractModel(title: string) {
  const upper = String(title || '').toUpperCase();

  const matches =
    upper.match(/\b[A-Z0-9]+(?:[-\/.][A-Z0-9]+){1,}\b/g) ||
    upper.match(/\b[A-Z]{1,5}\d{3,}[A-Z0-9-\/.]*\b/g) ||
    [];

  return matches[0] || 'UNKNOWN';
}

function detectBrand(title: string) {
  const brands = [
    'SIEMENS', 'ABB', 'SCHNEIDER', 'ALLEN-BRADLEY', 'OMRON', 'HONEYWELL',
    'YOKOGAWA', 'MITSUBISHI', 'GE', 'FANUC', 'KEYENCE', 'PHOENIX CONTACT',
    'TURCK', 'SICK', 'IFM', 'FESTO', 'EATON', 'PILZ', 'BECKHOFF', 'HIRSCHMANN',
    'ALSTOM', 'KAHLER'
  ];

  const upper = String(title || '').toUpperCase();
  return brands.find((b) => upper.includes(b)) || 'UNKNOWN';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') || 1);
  const offset = (page - 1) * LIMIT;

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q: 'Industrial Automation',
    limit: String(LIMIT),
    offset: String(offset),
    filter: 'sellers:{orbitcontrol}',
  });

  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept-Language': 'en-US',
      },
    }
  );

  const ebayData = await response.json();

  if (!response.ok) {
    return NextResponse.json({
      success: false,
      status: response.status,
      error: ebayData,
    });
  }

  const items = ebayData.itemSummaries || [];

  const products = items.map((item: any) => {
    const itemId = item.legacyItemId || item.itemId?.split('|')?.[1] || item.itemId || '';
    const title = item.title || '';
    const brand = detectBrand(title);
    const model = extractModel(title);

    return {
      ebay_item_id: itemId,
      sku: itemId,
      part_number: model,
      model_number: model,
      brand,
      category: item.categories?.[0]?.categoryName || 'Industrial Automation',
      name: cleanTitle(title),
      condition: item.condition || 'Used',
      image_url: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
      description: title,
      slug: slugify(`${itemId}-${cleanTitle(title)}`),
      marketplace: 'EBAY_US',
      seller: 'orbitcontrol',
      source: 'ebay-search',
      source_type: 'ebay',
      quantity: 1,
      price: item.price?.value ? Number(item.price.value) : null,
      currency: item.price?.currency || 'USD',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabaseAdmin
    .from('products')
    .upsert(products, { onConflict: 'sku' })
    .select('id, sku');

  return NextResponse.json({
    success: !error,
    page,
    offset,
    fetched: items.length,
    prepared: products.length,
    imported: data?.length || 0,
    error,
    sample: products.slice(0, 3),
  });
}
