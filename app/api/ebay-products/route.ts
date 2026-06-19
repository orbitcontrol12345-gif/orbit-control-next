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
  const cleaned = title
    .replace(/\b(Siemens|ABB|Schneider|Allen Bradley|Allen-Bradley|Honeywell|Omron|Yokogawa|Emerson|Foxboro|GE|General Electric)\b/gi, '')
    .replace(/\b(New|Used|Open Box|New Open Box|Without Box|No Box|W\/O Box)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleaned.match(/\b[A-Z0-9]{2,}[A-Z0-9\-\/\.]{2,}\b/i);

  return match ? match[0].toUpperCase() : cleaned.slice(0, 80);
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
  name: title,
  condition: item.condition || 'Used',
  image_url: item.image?.imageUrl || '',
  description: title,
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
