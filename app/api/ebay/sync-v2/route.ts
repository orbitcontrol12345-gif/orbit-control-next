import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractIndustrialPartNumberV2 } from '@/lib/industrial-part-number-v2';
import { detectIndustrialBrand } from '@/lib/industrial-brand';
import { makeCatalogIdentity } from '@/lib/catalog-identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_SIZE = 25;
const CONCURRENCY = 5;
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
    source: 'ebay-sync-v2',
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
    const offset = Number(url.searchParams.get('offset') || 0);
    const dryRun = url.searchParams.get('dryRun') !== 'false';
    const now = new Date().toISOString();

    const { access_token } = await getEbayToken();

    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('ebay_feed_snapshot')
      .select('ebay_item_id')
      .order('ebay_item_id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (snapshotError) throw snapshotError;

    if (!snapshotRows?.length) {
      return NextResponse.json({
        success: true,
        dryRun,
        offset,
        processed: 0,
        inserted: 0,
        updated: 0,
        hiddenDuplicates: 0,
        failed: 0,
        nextOffset: null,
      });
    }

    const ids = snapshotRows.map((row) => String(row.ebay_item_id));

    const results: Awaited<ReturnType<typeof fetchEbayItem>>[] = [];

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map((id) => fetchEbayItem(access_token, id))
      );
      results.push(...chunkResults);
    }

    let inserted = 0;
    let updated = 0;
    let hiddenDuplicates = 0;
    let failed = 0;

    const sample: any[] = [];

    for (let i = 0; i < ids.length; i++) {
      const fallbackItemId = ids[i];
      const result = results[i];

      if (!result.ok || !result.item) {
        failed++;
        sample.push({
          ebayItemId: fallbackItemId,
          action: 'failed_fetch',
          status: result.status,
        });
        continue;
      }

      const product = normalizeEbayProduct(result.item, fallbackItemId, now);

      if (!product) {
        failed++;
        sample.push({
          ebayItemId: fallbackItemId,
          action: 'failed_normalize',
        });
        continue;
      }

      const { data: existingByEbayId, error: existingError } =
        await supabaseAdmin
          .from('products')
          .select('id, ebay_item_id')
          .eq('marketplace', MARKETPLACE)
          .eq('ebay_item_id', product.ebay_item_id)
          .maybeSingle();

      if (existingError) throw existingError;

      if (existingByEbayId?.id) {
        if (!dryRun) {
          const { error: updateError } = await supabaseAdmin
            .from('products')
            .update(product)
            .eq('id', existingByEbayId.id);

          if (updateError) throw updateError;
        }

        updated++;
        sample.push({
          ebayItemId: product.ebay_item_id,
          action: 'update_existing_ebay_id',
          partNumber: product.part_number,
          catalogKey: product.catalog_key,
        });
        continue;
      }

      const { data: visibleDuplicate, error: duplicateError } =
        await supabaseAdmin
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

      if (visibleDuplicate?.id) {
        hiddenDuplicates++;
        sample.push({
          ebayItemId: product.ebay_item_id,
          action: 'insert_hidden_duplicate',
          duplicateOf: visibleDuplicate.id,
          partNumber: product.part_number,
          catalogKey: product.catalog_key,
        });
      } else {
        inserted++;
        sample.push({
          ebayItemId: product.ebay_item_id,
          action: 'insert_visible',
          partNumber: product.part_number,
          catalogKey: product.catalog_key,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      offset,
      limit: BATCH_SIZE,
      processed: ids.length,
      inserted,
      updated,
      hiddenDuplicates,
      failed,
      sample,
      nextOffset:
        snapshotRows.length === BATCH_SIZE ? offset + BATCH_SIZE : null,
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
