import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 50;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
    .replace(/\bWITH OLD BOX\b/gi, '')
    .replace(/\bWITHOUT BOX\b/gi, '')
    .replace(/\bNO BOX\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
    const now = new Date().toISOString();

    const { access_token } = await getEbayToken();

    const params = new URLSearchParams({
      q: 'industrial automation',
      limit: String(LIMIT),
      offset: String(offset),
      filter: 'sellers:{orbitcontrol}',
    });

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept-Language': 'en-US',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status: res.status,
        error: await res.text(),
      });
    }

    const data = await res.json();
    const items = data.itemSummaries || [];

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      const ebayItemId = String(item.legacyItemId || item.itemId?.split('|')?.[1] || '').trim();
      const title = String(item.title || '').trim();

      if (!ebayItemId || !title) {
        skipped++;
        continue;
      }

      const existing = await supabaseAdmin
        .from('products')
        .select('id, part_number, brand')
        .eq('ebay_item_id', ebayItemId)
        .maybeSingle();

      if (existing.data?.id) {
        const { error } = await supabaseAdmin
          .from('products')
          .update({
            last_seen_at: now,
            is_active: true,
            updated_at: now,
          })
          .eq('id', existing.data.id);

        if (error) throw error;
        updated++;
        continue;
      }

      const cleanedName = cleanTitle(title);
      const partNumber = extractPartNumber(title) || ebayItemId;
      const brand = detectIndustrialBrand(title);
      const imageUrl =
        item.image?.imageUrl ||
        item.thumbnailImages?.[0]?.imageUrl ||
        null;

      const product = {
        ebay_item_id: ebayItemId,
        sku: ebayItemId,
        part_number: partNumber,
        model_number: partNumber,
        brand,
        category: item.categories?.[0]?.categoryName || 'Industrial Automation',
        name: cleanedName,
        condition: item.condition || 'Used',
        image_url: imageUrl,
        description: title,
        slug: slugify(`${ebayItemId}-${cleanedName}`),
        marketplace: 'EBAY_US',
        seller: 'orbitcontrol',
        source: 'ebay-us-sync',
        source_type: 'ebay',
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      };

      const { error } = await supabaseAdmin
        .from('products')
        .insert(product);

      if (error) throw error;

      inserted++;
    }

    return NextResponse.json({
      success: true,
      marketplace: 'EBAY_US',
      offset,
      limit: LIMIT,
      total: data.total || null,
      returned: items.length,
      inserted,
      updated,
      skipped,
      nextOffset: items.length === LIMIT ? offset + LIMIT : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
