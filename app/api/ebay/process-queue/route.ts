import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 50;
const SELLER = 'orbitcontrol';
const MARKETPLACE = 'EBAY_US';

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/^\s*LOT\s+\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)?\s+/i, '')
    .replace(/^\s*\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)\s+/i, '')
    .replace(/^\s*LOT\s+OF\s+\d+\s+/i, '')
    .replace(/\bNEW OPEN BOX\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bTESTED\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bW\/O BOX\b/gi, '')
    .replace(/\bWITHOUT BOX\b/gi, '')
    .replace(/\bNO BOX\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractModel(title: string) {
  const upper = String(title || '').toUpperCase();

  const matches =
    upper.match(/\b[A-Z0-9]+(?:[-\/.][A-Z0-9]+){1,}\b/g) ||
    upper.match(/\b[A-Z]{1,6}\d{2,}[A-Z0-9\-\/.]*\b/g) ||
    [];

  return matches[0] || '';
}

function detectBrand(title: string) {
  const brands = [
    'SIEMENS',
    'ABB',
    'SCHNEIDER',
    'SCHNEIDER ELECTRIC',
    'ALLEN-BRADLEY',
    'ROCKWELL',
    'OMRON',
    'HONEYWELL',
    'YOKOGAWA',
    'MITSUBISHI',
    'GENERAL ELECTRIC',
    'GE',
    'FANUC',
    'KEYENCE',
    'PHOENIX CONTACT',
    'TURCK',
    'SICK',
    'IFM',
    'FESTO',
    'EATON',
    'PILZ',
    'BECKHOFF',
    'HIRSCHMANN',
    'BENTLY NEVADA',
    'REXROTH',
    'DANFOSS',
  ];

  const upper = String(title || '').toUpperCase();
  return brands.find((b) => upper.includes(b)) || 'UNKNOWN';
}

async function markQueue(
  ebayItemId: string,
  status: string,
  errorMessage: string | null = null
) {
  await supabaseAdmin
    .from('ebay_import_queue')
    .update({
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('ebay_item_id', ebayItemId);
}

export async function GET() {
  const now = new Date().toISOString();

  const { data: queueRows, error: queueError } = await supabaseAdmin
    .from('ebay_import_queue')
    .select('ebay_item_id, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(LIMIT);

  if (queueError) {
    return NextResponse.json(
      { success: false, error: queueError.message },
      { status: 500 }
    );
  }

  if (!queueRows || queueRows.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No pending items in queue.',
      processed: 0,
    });
  }

  const token = await getEbayToken();
  const accessToken = String(token.access_token || '').trim();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let rateLimited = false;

  const results: any[] = [];

  for (const row of queueRows) {
    const queueItemId = String(row.ebay_item_id || '').trim();

    if (!queueItemId) {
      failed++;
      continue;
    }

    await supabaseAdmin
      .from('ebay_import_queue')
      .update({
        status: 'processing',
        attempts: Number(row.attempts || 0) + 1,
        updated_at: now,
      })
      .eq('ebay_item_id', queueItemId);

    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('ebay_item_id', queueItemId)
      .maybeSingle();

    if (existing?.id) {
      await markQueue(queueItemId, 'completed', 'Already exists in products');
      skipped++;
      results.push({ ebayItemId: queueItemId, status: 'skipped_existing' });
      continue;
    }

    const params = new URLSearchParams({
      q: queueItemId,
      limit: '1',
      filter: `sellers:{${SELLER}}`,
    });

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
          'Accept-Language': 'en-US',
        },
      }
    );

    if (res.status === 429) {
      await markQueue(queueItemId, 'pending', 'EBAY_RATE_LIMIT_429');
      rateLimited = true;
      results.push({ ebayItemId: queueItemId, status: 'rate_limited' });
      break;
    }

    const ebayData = await res.json();

    if (!res.ok) {
      await markQueue(queueItemId, 'failed', JSON.stringify(ebayData).slice(0, 500));
      failed++;
      results.push({ ebayItemId: queueItemId, status: 'failed_fetch' });
      continue;
    }

    const item = ebayData.itemSummaries?.[0];

    if (!item) {
      await markQueue(queueItemId, 'failed', 'No item returned from Browse API');
      failed++;
      results.push({ ebayItemId: queueItemId, status: 'no_item' });
      continue;
    }

    const title = String(item.title || '').trim();
    const imageUrl =
      item.image?.imageUrl ||
      item.thumbnailImages?.[0]?.imageUrl ||
      '';

    if (!title) {
      await markQueue(queueItemId, 'failed', 'Missing title');
      failed++;
      results.push({ ebayItemId: queueItemId, status: 'missing_title' });
      continue;
    }

    const realItemId =
      String(item.legacyItemId || '').trim() ||
      String(item.itemId || '').split('|')[1] ||
      queueItemId;

    const cleanedName = cleanTitle(title) || title || `eBay Item ${realItemId}`;
    const extractedModel = extractModel(title);

    const finalModel =
      extractedModel ||
      String(item.mpn || '').trim() ||
      realItemId;

    const brand =
      String(item.brand || '').trim() ||
      detectBrand(title);

    const product = {
      ebay_item_id: realItemId,
      sku: realItemId,
      part_number: finalModel,
      model_number: finalModel,
      brand,
      category: item.categories?.[0]?.categoryName || 'Industrial Automation',
      name: cleanedName,
      condition: item.condition || 'Used',
      image_url: imageUrl,
      description: title,
      slug: slugify(`${realItemId}-${cleanedName}`),
      marketplace: MARKETPLACE,
      seller: SELLER,
      source: 'ebay-browse-queue',
      source_type: 'ebay',
      quantity: 1,
      price: item.price?.value ? Number(item.price.value) : null,
      currency: item.price?.currency || 'USD',
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabaseAdmin
      .from('products')
      .upsert(product, { onConflict: 'ebay_item_id' });

    if (insertError) {
      await markQueue(queueItemId, 'failed', insertError.message);
      failed++;
      results.push({
        ebayItemId: queueItemId,
        status: 'failed_insert',
        error: insertError.message,
      });
      continue;
    }

    await markQueue(queueItemId, 'completed', null);
    imported++;
    results.push({
      ebayItemId: queueItemId,
      status: 'imported',
      part_number: finalModel,
      name: cleanedName,
    });
  }

  return NextResponse.json({
    success: true,
    limit: LIMIT,
    imported,
    skipped,
    failed,
    rateLimited,
    results,
  });
}
