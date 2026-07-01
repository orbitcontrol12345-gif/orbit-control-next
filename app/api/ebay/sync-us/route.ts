import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_SIZE = 50;
const CONCURRENCY = 10;

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

async function fetchEbayItem(accessToken: string, ebayItemId: string) {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${ebayItemId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
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
        offset,
        processed: 0,
        inserted: 0,
        updated: 0,
        failed: 0,
        nextOffset: null,
      });
    }

    const ids = snapshotRows.map((row) => String(row.ebay_item_id));

    const { data: existingProducts, error: existingError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        name,
        brand,
        part_number,
        model_number,
        category,
        description,
        image_url,
        condition,
        is_active
      `)
      .in('ebay_item_id', ids);

    if (existingError) throw existingError;

    const existingMap = new Map(
      (existingProducts || []).map((product) => [
        String(product.ebay_item_id),
        product,
      ])
    );

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
    let failed = 0;

    const sample: any[] = [];

    for (let i = 0; i < ids.length; i++) {
      const ebayItemId = ids[i];
      const result = results[i];

      if (!result.ok || !result.item) {
        failed++;
        sample.push({
          ebayItemId,
          status: result.status,
          action: 'failed_fetch',
        });
        continue;
      }

      const item = result.item;
      const realItemId = getRealItemId(item.itemId) || ebayItemId;
      const title = String(item.title || '').trim();

      if (!title) {
        failed++;
        sample.push({
          ebayItemId,
          action: 'failed_missing_title',
        });
        continue;
      }

      const cleanedName = cleanTitle(title);
      const detectedPart = extractPartNumber(title);
      const partNumber = detectedPart || realItemId;

      const aspectBrand =
        item.localizedAspects?.find(
          (a: any) => String(a.name || '').toLowerCase() === 'brand'
        )?.value || '';

      const brand = detectIndustrialBrand(
        [item.brand, aspectBrand, title, cleanedName, partNumber]
          .filter(Boolean)
          .join(' ')
      );

      const imageUrl =
        item.image?.imageUrl ||
        item.thumbnailImages?.[0]?.imageUrl ||
        item.additionalImages?.[0]?.imageUrl ||
        null;

      const category = item.categoryPath || 'Industrial Automation';
      const condition = item.condition || 'Used';

      const existing =
        existingMap.get(realItemId) || existingMap.get(ebayItemId);

      if (existing?.id) {
        const updates: any = {
          last_seen_at: now,
          is_active: true,
          updated_at: now,
        };

        if (cleanedName && cleanedName !== existing.name) {
          updates.name = cleanedName;
        }

        if (title && title !== existing.description) {
          updates.description = title;
        }

        if (imageUrl && imageUrl !== existing.image_url) {
          updates.image_url = imageUrl;
        }

        if (condition && condition !== existing.condition) {
          updates.condition = condition;
        }

        if (category && category !== existing.category) {
          updates.category = category;
        }

        if (brand && brand !== 'UNKNOWN' && brand !== existing.brand) {
          updates.brand = brand;
        }

        const currentPart = String(existing.part_number || '').trim();

        if (
          (!currentPart || currentPart === String(existing.name || '').trim()) &&
          partNumber &&
          partNumber !== realItemId
        ) {
          updates.part_number = partNumber;
          updates.model_number = partNumber;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update(updates)
          .eq('id', existing.id);

        if (updateError) throw updateError;

        updated++;

        sample.push({
          ebayItemId: realItemId,
          action:
            Object.keys(updates).length > 3
              ? 'updated_changed_fields'
              : 'seen',
          title,
        });

        continue;
      }
const duplicateCheck =
  brand &&
  brand !== 'UNKNOWN' &&
  partNumber &&
  partNumber !== realItemId
    ? await supabaseAdmin
        .from('products')
        .select('id, ebay_item_id')
        .eq('marketplace', 'EBAY_US')
        .eq('is_active', true)
        .eq('brand', brand)
        .eq('part_number', partNumber)
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: [], error: null };

if (duplicateCheck.error) throw duplicateCheck.error;

const duplicate = duplicateCheck.data?.[0];

if (duplicate?.id) {
  await supabaseAdmin
    .from('products')
    .update({
      last_seen_at: now,
      updated_at: now,
    })
    .eq('id', duplicate.id)

  updated++;

  sample.push({
    ebayItemId: realItemId,
    action: 'duplicate_skipped',
    existingProductId: duplicate.id,
    brand,
    partNumber,
    title,
  });

  continue;
}
      const product = {
        ebay_item_id: realItemId,
        sku: realItemId,
        part_number: partNumber,
        model_number: partNumber,
        brand,
        category,
        name: cleanedName,
        condition,
        image_url: imageUrl,
        description: title,
        slug: slugify(`${realItemId}-${cleanedName}`),
        marketplace: 'EBAY_US',
        seller: 'orbitcontrol',
        source: 'ebay-us-sync',
        source_type: 'ebay',
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      };

      const { error: insertError } = await supabaseAdmin
        .from('products')
        .insert(product);

      if (insertError) throw insertError;

      inserted++;

      sample.push({
        ebayItemId: realItemId,
        action: 'inserted',
        brand,
        partNumber,
        title,
      });
    }

    return NextResponse.json({
      success: true,
      offset,
      limit: BATCH_SIZE,
      processed: ids.length,
      inserted,
      updated,
      failed,
      sample: sample.slice(0, 10),
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
