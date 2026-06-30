import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 50;

function getRealItemId(itemId: string) {
  return String(itemId || '').split('|')[1] || String(itemId || '');
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
    const now = new Date().toISOString();

    const { access_token } = await getEbayToken();

    const { data: rows, error } = await supabaseAdmin
      .from('ebay_feed_snapshot')
      .select('ebay_item_id')
      .order('ebay_item_id')
      .range(offset, offset + LIMIT - 1);

    if (error) throw error;

    if (!rows?.length) {
      return NextResponse.json({
        success: true,
        offset,
        processed: 0,
        usItems: 0,
        nextOffset: null,
      });
    }

    let processed = 0;
    let usItems = 0;
    const sample: any[] = [];

    for (const row of rows) {
      const ebayItemId = String(row.ebay_item_id);

      const res = await fetch(
        `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${ebayItemId}`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Accept-Language': 'en-US',
          },
        }
      );

      processed++;

      if (!res.ok) {
        sample.push({
          ebayItemId,
          status: res.status,
          us: false,
        });
        continue;
      }

      const item = await res.json();
      const realId = getRealItemId(item.itemId);

      await supabaseAdmin
        .from('ebay_feed_snapshot')
        .update({
          marketplace: 'EBAY_US',
          updated_at: now,
          raw: {
            classified_from_browse: true,
            itemId: item.itemId,
            legacyItemId: realId,
            title: item.title,
            condition: item.condition,
          },
        })
        .eq('ebay_item_id', ebayItemId);

      usItems++;

      sample.push({
        ebayItemId,
        us: true,
        title: item.title,
      });
    }

    return NextResponse.json({
      success: true,
      offset,
      processed,
      usItems,
      sample,
      nextOffset: rows.length === LIMIT ? offset + LIMIT : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
