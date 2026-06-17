import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEbayToken } from '@/lib/ebay';
export const dynamic = 'force-dynamic';
const SELLER = 'orbitcontrol';
const MARKETPLACE = 'EBAY_US';

function makeSlug(title: string, itemId: string) {
  return `${itemId}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const limit = 200;
    const offset = (page - 1) * limit;

    const tokenData = await getEbayToken();
    const token =
      typeof tokenData === 'string' ? tokenData : tokenData.access_token;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No eBay access token',
        tokenData,
      });
    }

    const { data: existingItems, error: existingError } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id');

    if (existingError) {
      return NextResponse.json({ success: false, error: existingError.message });
    }

    const existingIds = new Set(
      (existingItems || []).map((x: any) => String(x.ebay_item_id)).filter(Boolean)
    );

    const ebayUrl =
  `https://api.ebay.com/buy/browse/v1/item_summary/search?q=CONTROL&limit=${limit}&offset=${offset}&filter=sellers:{${SELLER}}`;
     
    const response = await fetch(ebayUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
      },
    });

    const json = await response.json();
    const items = json.itemSummaries || [];

    let imported = 0;
    let skipped = 0;
    const insertedIds: string[] = [];
    const errors: any[] = [];

    for (const item of items) {
      const ebayItemId = String(item.itemId || '');
      if (!ebayItemId) continue;

      if (existingIds.has(ebayItemId)) {
        skipped++;
        continue;
      }

      const title = item.title || `eBay Item ${ebayItemId}`;

      const product = {
        ebay_item_id: ebayItemId,
        sku: ebayItemId,
        name: title,
        part_number: ebayItemId,
        brand: item.brand || null,
        category: item.categories?.[0]?.categoryName || 'Other Business & Industrial',
        condition: item.condition || 'Used',
        image_url: item.image?.imageUrl || '',
        description: title,
        slug: makeSlug(title, ebayItemId),
        marketplace: MARKETPLACE,
        seller: SELLER,
        source: 'ebay',
        is_active: true,
        last_seen_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin.from('products').insert(product);

      if (error) {
        errors.push({ ebayItemId, error: error.message });
      } else {
        imported++;
        insertedIds.push(ebayItemId);
        existingIds.add(ebayItemId);
      }
    }

    return NextResponse.json({
      success: true,
      page,
      limit,
      offset,
      totalFromEbay: items.length,
      imported,
      skipped,
      insertedIds,
      ebayErrors: json.errors || null,
      insertErrors: errors.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
