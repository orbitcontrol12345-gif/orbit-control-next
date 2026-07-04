import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractIndustrialPartNumberV2 } from '@/lib/industrial-part-number-v2';
import { detectIndustrialBrand } from '@/lib/industrial-brand';
import { makeCatalogIdentity } from '@/lib/catalog-identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';

function slugify(text: string) {
  return String(text || '')
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
    .replace(/\bW\/O BOX\b/gi, '')
    .replace(/\bOLD STOCK\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRealItemId(itemId: string) {
  return String(itemId || '').split('|')[1] || String(itemId || '');
}

function isEbayId(value: string) {
  const v = String(value || '').trim();
  return /^27\d{10}$/.test(v) || /^\d{12,13}$/.test(v);
}

function safePartNumber(item: any, title: string, ebayItemId: string) {
  const aspects = item.localizedAspects || [];

  const aspectPart =
    aspects.find((a: any) =>
      ['mpn', 'model', 'model number', 'manufacturer part number'].includes(
        String(a.name || '').toLowerCase()
      )
    )?.value || '';

  const extracted = extractIndustrialPartNumberV2(title);

  const candidates = [extracted, aspectPart]
    .map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
        .replace(/\s*-\s*/g, '-')
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .filter((x) => x !== ebayItemId)
    .filter((x) => !isEbayId(x))
    .filter((x) => !/^\d+\/\d+HZ$/i.test(x))
    .filter((x) => !/^\d+(\.\d+)?(VAC|VDC|AC|DC|V|HZ|KW|W|A|MA)$/i.test(x));

  return candidates[0] || 'UNKNOWN';
}

async function fetchEbayItem(accessToken: string, ebayItemId: string) {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${ebayItemId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: await res.text(),
      item: null,
    };
  }

  return {
    ok: true,
    status: res.status,
    error: null,
    item: await res.json(),
  };
}

function normalizeEbayProduct(item: any, fallbackItemId: string, now: string) {
  const realItemId = getRealItemId(item.itemId) || fallbackItemId;
  const title = String(item.title || '').trim();

  if (!title) return null;

  const name = cleanTitle(title);
  const partNumber = safePartNumber(item, title, realItemId);

  const aspectBrand =
    item.localizedAspects?.find(
      (a: any) => String(a.name || '').toLowerCase() === 'brand'
    )?.value || '';

  const brand = detectIndustrialBrand(
    [item.brand, aspectBrand, title, name, partNumber].filter(Boolean).join(' ')
  );

  const imageUrl =
    item.image?.imageUrl ||
    item.thumbnailImages?.[0]?.imageUrl ||
    item.additionalImages?.[0]?.imageUrl ||
    null;

  const category = item.categoryPath || 'Industrial Automation';
  const condition = item.condition || 'Used';

  const { catalogKey } = makeCatalogIdentity({
    brand,
    partNumber,
    name,
    condition,
  });

  return {
    ebay_item_id: realItemId,
    sku: realItemId,
    part_number: partNumber,
    model_number: partNumber,
    brand,
    category,
    name,
    condition,
    image_url: imageUrl,
    description: title,
    slug: slugify(`${realItemId}-${name}`),
    marketplace: MARKETPLACE,
    seller: SELLER,
    source: 'ebay-sync-one',
    source_type: 'ebay',
    catalog_key: catalogKey,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const dryRun = url.searchParams.get('dryRun') !== 'false';
    const now = new Date().toISOString();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id' },
        { status: 400 }
      );
    }

    const { access_token } = await getEbayToken();
    const result = await fetchEbayItem(access_token, id);

    if (!result.ok || !result.item) {
      return NextResponse.json(
        {
          success: false,
          action: 'failed_fetch',
          ebayItemId: id,
          status: result.status,
          error: result.error,
        },
        { status: 500 }
      );
    }

    const product = normalizeEbayProduct(result.item, id, now);

    if (!product) {
      return NextResponse.json(
        { success: false, action: 'failed_normalize', ebayItemId: id },
        { status: 500 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('products')
      .select('id, ebay_item_id')
      .eq('marketplace', MARKETPLACE)
      .eq('ebay_item_id', product.ebay_item_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      if (!dryRun) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update(product)
          .eq('id', existing.id);

        if (updateError) throw updateError;
      }

      return NextResponse.json({
        success: true,
        dryRun,
        action: 'updated_existing_ebay_id',
        productId: existing.id,
        ebayItemId: product.ebay_item_id,
        brand: product.brand,
        partNumber: product.part_number,
        catalogKey: product.catalog_key,
        name: product.name,
      });
    }

    const { data: visibleDuplicate, error: duplicateError } = await supabaseAdmin
      .from('products')
      .select('id, ebay_item_id')
      .eq('marketplace', MARKETPLACE)
      .eq('catalog_key', product.catalog_key)
      .eq('catalog_visible', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;

    const finalProduct = {
      ...product,
      catalog_visible: !visibleDuplicate?.id,
      duplicate_of: visibleDuplicate?.id || null,
    };

    if (!dryRun) {
      const { error: insertError } = await supabaseAdmin
        .from('products')
        .insert(finalProduct);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      action: visibleDuplicate?.id
        ? 'inserted_hidden_duplicate'
        : 'inserted_visible',
      duplicateOf: visibleDuplicate?.id || null,
      ebayItemId: product.ebay_item_id,
      brand: product.brand,
      partNumber: product.part_number,
      catalogKey: product.catalog_key,
      name: product.name,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
