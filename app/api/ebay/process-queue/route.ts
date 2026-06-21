import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 50;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/^\s*LOT\s+\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)?\s+/i, '')
    .replace(/^\s*\d+\s*(PCS|PC|PIECES|PCS\.|PC\.)\s+/i, '')
    .replace(/^\s*LOT\s+OF\s+\d+\s+/i, '')
    .replace(/\bNEW OPEN BOX\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
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
    upper.match(/\b[A-Z]{1,5}\d{3,}[A-Z0-9-\/.]*\b/g) ||
    [];

  return matches[0] || '';
}

function detectBrand(title: string) {
  const brands = [
    'SIEMENS',
    'ABB',
    'SCHNEIDER',
    'ALLEN-BRADLEY',
    'OMRON',
    'HONEYWELL',
    'YOKOGAWA',
    'MITSUBISHI',
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
    return NextResponse.json({ success: false, error: queueError }, { status: 500 });
  }

  if (!queueRows || queueRows.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No pending items in queue.',
      processed: 0,
    });
  }

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let rateLimited = false;

  const results: any[] = [];

  for (const row of queueRows) {
    const ebayItemId = row.ebay_item_id;

    await supabaseAdmin
      .from('ebay_import_queue')
      .update({
        status: 'processing',
        attempts: Number(row.attempts || 0) + 1,
        updated_at: now,
      })
      .eq('ebay_item_id', ebayItemId);

    const already = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('ebay_item_id', ebayItemId)
      .maybeSingle();

    if (already.data?.id) {
      await markQueue(ebayItemId, 'completed', 'Already exists in products');
      skipped++;
      results.push({ ebayItemId, status: 'skipped_existing' });
      continue;
    }

    const params = new URLSearchParams({
      q: ebayItemId,
      limit: '1',
      filter: 'sellers:{orbitcontrol}',
    });

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept-Language': 'en-US',
        },
      }
    );

    if (res.status === 429) {
      await markQueue(ebayItemId, 'pending', 'EBAY_RATE_LIMIT_429');
      rateLimited = true;
      results.push({ ebayItemId, status: 'rate_limited' });
      break;
    }

    const ebayData = await res.json();

    if (!res.ok) {
      await markQueue(ebayItemId, 'failed', JSON.stringify(ebayData).slice(0, 500));
      failed++;
      results.push({ ebayItemId, status: 'failed_fetch' });
      continue;
    }

    const item = ebayData.itemSummaries?.[0];

    if (!item) {
      await markQueue(ebayItemId, 'failed', 'No item returned from Browse API');
      failed++;
      results.push({ ebayItemId, status: 'no_item' });
      continue;
    }

    const title = item.title || '';
    const imageUrl = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '';
    const realItemId = item.legacyItemId || item.itemId?.split('|')?.[1] || ebayItemId;

    if (!title || !imageUrl || title.includes('Orbit Control Industrial Item')) {
      await markQueue(ebayItemId, 'failed', 'Missing title or image');
      failed++;
      results.push({ ebayItemId, status: 'failed_missing_data' });
      continue;
    }

    const cleanedName = cleanTitle(title);
    const model = extractModel(title);
    const brand = detectBrand(title);

    if (!cleanedName || !model) {
      await markQueue(ebayItemId, 'failed', 'Missing clean name or model');
      failed++;
      results.push({ ebayItemId, status: 'failed_missing_model' });
      continue;
    }

    const product = {
      ebay_item_id: realItemId,
      sku: realItemId,
      part_number: model,
      model_number: model,
      brand,
      category: item.categories?.[0]?.categoryName || 'Industrial Automation',
      name: cleanedName,
      condition: item.condition || 'Used',
      image_url: imageUrl,
      description: title,
      slug: slugify(`${realItemId}-${cleanedName}`),
      marketplace: 'EBAY_US',
      seller: 'orbitcontrol',
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
      await markQueue(ebayItemId, 'failed', insertError.message);
      failed++;
      results.push({ ebayItemId, status: 'failed_insert', error: insertError.message });
      continue;
    }

    await markQueue(ebayItemId, 'completed', null);
    imported++;
    results.push({ ebayItemId, status: 'imported', name: cleanedName });
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
