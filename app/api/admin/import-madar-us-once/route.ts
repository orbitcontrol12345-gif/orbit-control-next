import { NextRequest, NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeEbayItem, getRealItemId } from '@/lib/ebay-normalizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELLER = 'madarautomation';
const MARKETPLACE = 'EBAY_US';
const PAGE_SIZE = 50;
const MAX_PAGE = 40;
const RUN_KEY = 'madar-us-20260915';

function key(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function nameKey(value: unknown) {
  return String(value || '').toUpperCase().replace(/\b(NEW|USED|OPEN BOX|WITHOUT BOX|NO BOX|LOT OF|LOT|PCS|PIECES|UNITS)\b/g, ' ').replace(/[^A-Z0-9]/g, '');
}

function imageKey(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/^(.*\/images\/g\/[^/]+\/)/i);
    return (url.hostname + (match?.[1] || url.pathname)).toLowerCase();
  } catch {
    return raw.split('?')[0].toLowerCase();
  }
}

async function allExisting() {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id,sku,part_number,model_number,name,image_url,ebay_image_url,ebay_gallery_urls,r2_image_url,r2_gallery_urls')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function details(token: string, item: any) {
  const browseId = String(item?.itemId || '');
  if (!browseId) return item;
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(browseId)}`,
    { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE, 'Accept-Language': 'en-US' }, cache: 'no-store' }
  );
  return response.ok ? response.json() : item;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('key') !== RUN_KEY) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const page = Math.min(Math.max(Number(request.nextUrl.searchParams.get('page') || 1), 1), MAX_PAGE);
    const offset = (page - 1) * PAGE_SIZE;
    const tokenResult = await getEbayToken();
    const token = String(tokenResult?.access_token || '');
    if (!token) throw new Error('Missing eBay access token');

    const params = new URLSearchParams({
      category_ids: '12576',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      filter: `sellers:{${SELLER}},deliveryCountry:US`,
    });
    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE, 'Accept-Language': 'en-US' }, cache: 'no-store' }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(payload).slice(0, 800));

    const existing = await allExisting();
    const itemIds = new Set(existing.map(r => getRealItemId(r.ebay_item_id)).filter(Boolean));
    const skus = new Set(existing.map(r => key(r.sku)).filter(Boolean));
    const parts = new Set(existing.flatMap(r => [key(r.part_number), key(r.model_number)]).filter(v => v && v !== 'UNKNOWN'));
    const names = new Set(existing.map(r => nameKey(r.name)).filter(Boolean));
    const images = new Set(existing.flatMap(r => [
      r.image_url, r.ebay_image_url, r.r2_image_url,
      ...(Array.isArray(r.ebay_gallery_urls) ? r.ebay_gallery_urls : []),
      ...(Array.isArray(r.r2_gallery_urls) ? r.r2_gallery_urls : []),
    ]).map(imageKey).filter(Boolean));

    const summaries = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
    let imported = 0;
    const skipped = { ebayItemId: 0, sku: 0, partNumber: 0, name: 0, image: 0, invalid: 0 };
    const inserted: any[] = [];
    const errors: any[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < summaries.length; i += 5) {
      const chunk = summaries.slice(i, i + 5);
      const resolved = await Promise.all(chunk.map((item: any) => details(token, item)));
      for (const item of resolved) {
        try {
          const ebayItemId = getRealItemId(item?.itemId);
          const row = {
            ebay_item_id: ebayItemId,
            sku: ebayItemId,
            price: Number(item?.price?.value || 0) || null,
            currency: String(item?.price?.currency || 'USD'),
            quantity: 1,
          };
          if (row.currency !== 'USD') { skipped.invalid++; continue; }
          const product = normalizeEbayItem(item, row, now, { source: 'ebay-madar-us-import', seller: SELLER });
          if (!product) { skipped.invalid++; continue; }

          const productImages = [product.image_url, ...product.ebay_gallery_urls].map(imageKey).filter(Boolean);
          const pn = key(product.part_number);
          const mn = key(product.model_number);
          let reason: keyof typeof skipped | null = null;
          if (itemIds.has(product.ebay_item_id)) reason = 'ebayItemId';
          else if (skus.has(key(product.sku))) reason = 'sku';
          else if ((pn && pn !== 'UNKNOWN' && parts.has(pn)) || (mn && mn !== 'UNKNOWN' && parts.has(mn))) reason = 'partNumber';
          else if (names.has(nameKey(product.name))) reason = 'name';
          else if (productImages.some(v => images.has(v))) reason = 'image';

          if (reason) { skipped[reason]++; continue; }

          const { error } = await supabaseAdmin.from('products').insert(product);
          if (error) throw error;
          imported++;
          inserted.push({ ebayItemId: product.ebay_item_id, sku: product.sku, partNumber: product.part_number, name: product.name });
          itemIds.add(product.ebay_item_id);
          skus.add(key(product.sku));
          if (pn && pn !== 'UNKNOWN') parts.add(pn);
          if (mn && mn !== 'UNKNOWN') parts.add(mn);
          names.add(nameKey(product.name));
          productImages.forEach(v => images.add(v));
        } catch (error) {
          errors.push({ itemId: getRealItemId(item?.itemId), error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return NextResponse.json({
      success: true, seller: SELLER, marketplace: MARKETPLACE, currency: 'USD',
      page, offset, total: Number(payload?.total || 0), fetched: summaries.length,
      imported, skipped, inserted, errors,
      hasMore: offset + summaries.length < Number(payload?.total || 0),
      nextPage: offset + summaries.length < Number(payload?.total || 0) ? page + 1 : null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
