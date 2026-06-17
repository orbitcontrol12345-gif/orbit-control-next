import { NextRequest, NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q') || 'SIEMENS';
    const page = Number(searchParams.get('page') || '1');
    const limit = 200;
    const offset = (page - 1) * limit;

    const tokenData = await getEbayToken();
    const token = tokenData.access_token;

    const ebayUrl =
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}` +
      `&limit=${limit}&offset=${offset}&filter=sellers:{orbitcontrol}`;

    const response = await fetch(ebayUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    const json = await response.json();

    if (json.errors) {
      return NextResponse.json({
        success: false,
        ebayErrors: json.errors,
      });
    }

    const items = json.itemSummaries || [];

    let imported = 0;
    let skipped = 0;

    for (const item of items) {
      const ebayItemId = String(item.itemId || '');

      if (!ebayItemId) continue;

      const { data: existing } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('ebay_item_id', ebayItemId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const title = item.title || ebayItemId;

      const product = {
        ebay_item_id: ebayItemId,
        sku: ebayItemId,
        part_number: ebayItemId,
        name: title,
        description: title,
        slug: `${title}-${ebayItemId}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        brand: item.brand || null,
        category:
          item.categories?.[0]?.categoryName ||
          'Other Business & Industrial',
        condition: item.condition || 'Used',
        image_url: item.image?.imageUrl || '',
        marketplace: 'EBAY_US',
        seller: 'orbitcontrol',
        source: 'ebay',
        is_active: true,
        model_number: item.mpn || null,
        mpn: item.mpn || null,
      };

      const { error } = await supabaseAdmin
        .from('products')
        .insert(product);

      if (!error) {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      q,
      page,
      totalFromEbay: items.length,
      imported,
      skipped,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
