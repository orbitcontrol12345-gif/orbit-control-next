import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}
function extractModelFromTitle(title: string) {
  const ignored = [
    'SIEMENS',
    'SIMATIC',
    'SITOP',
    'SIRIUS',
    'SINAMICS',
    'CPU',
    'HMI',
    'PLC',
    'MODULE',
    'POWER',
    'SUPPLY',
    'INTERFACE',
    'RELAY',
    'NEW',
    'USED',
    'OPEN',
    'BOX',
  ];

  const matches = title.match(/\b[A-Z0-9]+(?:[-\/\.][A-Z0-9]+)+\b/gi) || [];

  const filtered = matches
    .map((m) => m.toUpperCase())
    .filter((m) => {
      if (m.length < 4) return false;
      if (ignored.includes(m)) return false;
      if (/^\d{10,}$/.test(m)) return false;
      return true;
    });

  return filtered[0] || '';
}
function cleanTitle(title: string) {
  return title
    .replace(/\bNEW OPEN BOX\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bFOR PARTS\b/gi, '')
    .replace(/\bPARTS ONLY\b/gi, '')
    .replace(/\bNOT WORKING\b/gi, '')
    .replace(/\bPARTS OR NOT WORKING\b/gi, '')
    .replace(/\bW\/O BOX\b/gi, '')
    .replace(/\bWITHOUT BOX\b/gi, '')
    .replace(/\bNO BOX\b/gi, '')
    .replace(/\bFILTHY BOX\b/gi, '')
    .replace(/\bWITH FILTHY BOX\b/gi, '')
    .replace(/\bDAMAGED BOX\b/gi, '')
    .replace(/\bOLD BOX\b/gi, '')
    .replace(/\bWITH OLD BOX\b/gi, '')
    .replace(/\bNC\/NO\b/gi, '')
.replace(/\bWITH SOCKET\b/gi, '')
.replace(/\bW\/\b/gi, '')
.replace(/\bWITH\b/gi, '')
.replace(/\bSOCKET\b/gi, '')
.replace(/\s*-\s*$/g, '')
.replace(/\s*\/\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const save = searchParams.get('save') === 'true';

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q: 'Siemens',
    limit: '10',
    offset: searchParams.get('offset') || '0',
    filter: 'sellers:{orbitcontrol}',
  });

  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  );

  const data = await response.json();
  const items = data.itemSummaries || [];

  const products = items.map((item: any) => {
    const title = item.title || '';
    const ebayItemId = item.legacyItemId || item.itemId || '';

    const brandMatch = title.match(
      /\b(Siemens|ABB|Schneider|Allen Bradley|Allen-Bradley|Honeywell|Omron|Yokogawa|Emerson|Foxboro|GE|General Electric|Bosch|Phoenix|Phoenix Contact|Danfoss|Mitsubishi|Fuji|Keyence|Banner|Sick|IFM|Festo|Eaton|Cutler Hammer|Square D)\b/i
    );

    const brand = brandMatch ? brandMatch[1] : 'Unknown';

    return {
  ebay_item_id: ebayItemId,
  sku: ebayItemId,
  part_number: extractModelFromTitle(title),
  brand,
  category: item.categories?.[0]?.categoryName || 'Industrial Automation',
  name: cleanTitle(title),
  condition: item.condition || 'Used',
  image_url: item.image?.imageUrl || '',
  description: cleanTitle(title),
  slug: slugify(`${ebayItemId}-${title}`),
  marketplace: 'EBAY_US',
  seller: 'orbitcontrol',
  source: 'ebay',
  is_active: true,
};
  });

  if (save && products.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No products fetched from eBay.',
      ebayResponse: data,
      products,
    });
  }

  let inserted = 0;
  let supabaseError = null;

  if (save) {
    const { data: insertedData, error } = await supabaseAdmin
      .from('products')
      .upsert(products, { onConflict: 'sku' })
      .select();

    if (error) supabaseError = error;
    else inserted = insertedData?.length || 0;
  }

  return NextResponse.json({
    success: !supabaseError,
    fetched: products.length,
    inserted,
    saved: save,
    supabaseError,
    products,
  });
}
