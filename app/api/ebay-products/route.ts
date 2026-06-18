import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractModelFromTitle(title: string) {
  return title;
}
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const save = searchParams.get('save') === 'true';

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q: 'Industrial Automation & Motion Controls',
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
    const partNumber = extractModelFromTitle(title);

    const brandMatch = title.match(
  /\b(Siemens|ABB|Schneider|Allen Bradley|Allen-Bradley|Honeywell|Omron|Yokogawa|Emerson|Foxboro|GE|General Electric|Bosch|Phoenix|Phoenix Contact|Danfoss|Pepperl|Pepperl Fuchs|Endress|Mitsubishi|Fuji|Keyence|Banner|Sick|IFM|Festo|Parker|Advantech|Alstom|IDEC|MICOM|Areva|Schweitzer|SEL|Moxa|Bently Nevada|Triconex|Woodward|Prosoft|Hirschmann|Kahle|Kollmorgen|Lenze|Bailey|Westinghouse|Eaton|Cutler Hammer|Square D|Telemecanique)\b/i
);

    const brand = brandMatch ? brandMatch[1] : 'Unknown';

    return {
  sku: ebayItemId,
  ebay_item_id: ebayItemId,
  part_number: ebayItemId,
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
  last_seen_at: new Date().toISOString(),
};
  });

  let inserted = 0;
  let supabaseError = null;

  if (save) {
    const { data: insertedData, error } = await supabaseAdmin
  .from('products_test')
  .insert(products)
  .select();

    if (error) {
      supabaseError = error;
    } else {
      inserted = insertedData?.length || 0;
    }
  }

  return NextResponse.json({
    success: !supabaseError,
    marketplace: 'EBAY_US',
    seller: 'orbitcontrol',
    fetched: products.length,
    inserted,
    saved: save,
    supabaseError,
    products,
  });
}
