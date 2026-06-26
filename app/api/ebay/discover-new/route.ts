import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELLER = 'orbitcontrol';
const MARKETPLACE = 'EBAY_US';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'industrial automation';
  const limit = Number(url.searchParams.get('limit') || 200);
  const offset = Number(url.searchParams.get('offset') || 0);

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(limit, 200)),
    offset: String(offset),
    filter: `sellers:{${SELLER}},itemLocationCountry:US`,
    sort: 'newlyListed',
  });

  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { success: false, status: res.status, error: data },
      { status: 500 }
    );
  }

  const items = data.itemSummaries || [];

  const rows = items
    .map((item: any) => {
      const itemId =
        String(item.legacyItemId || '').trim() ||
        String(item.itemId || '').split('|')[1] ||
        '';

      return itemId ? { ebay_item_id: itemId, status: 'pending' } : null;
    })
    .filter(Boolean);

  const { data: inserted, error } = await supabaseAdmin
    .from('ebay_import_queue')
    .upsert(rows, { onConflict: 'ebay_item_id' })
    .select('ebay_item_id');

  return NextResponse.json({
    success: !error,
    q,
    offset,
    received: items.length,
    addedToQueue: inserted?.length || 0,
    totalFromEbay: data.total || null,
    nextUrl: `/api/ebay/discover-new?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset + limit}`,
    error,
    sample: rows.slice(0, 10),
  });
}
