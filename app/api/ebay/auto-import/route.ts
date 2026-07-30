import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = 'ebay-auto-import';
const MARKETPLACE = 'EBAY_US';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CONCURRENCY = 8;

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

function cleanTitle(title: string) {
  return String(title || '')
    // Packaging phrases only — never remove standalone BOX.
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?(?:OLD\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITH\s+(?:THE\s+)?(?:OLD\s+|ORIGINAL\s+|DAMAGED\s+|FILTHY\s+)?BOX\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNO\s+BOX\b/gi, ' ')
    .replace(/\bW\/?O\s+BOX\b/gi, ' ')
    .replace(/\bOPEN\s+BOX\b/gi, ' ')
    .replace(/\bOLD\s+BOX\b/gi, ' ')
    .replace(/\bORIGINAL\s+BOX\b/gi, ' ')
    .replace(/\bDAMAGED\s+BOX\b/gi, ' ')
    .replace(/\bFILTHY\s+BOX\b/gi, ' ')
    .replace(/\bBOX\s+ONLY\b/gi, ' ')
    .replace(/\bOLD\s+STOCK\b/gi, ' ')

    // Missing accessories or components.
    .replace(/\bWITHOUT\s+(?:ANY\s+)?ACCESSORIES\b/gi, ' ')
    .replace(/\bW\/?O\s+ACCESSORIES\b/gi, ' ')
    .replace(/\bNO\s+ACCESSORIES\b/gi, ' ')
    .replace(/\bNO\s+POWER\s+SUPPLY\b/gi, ' ')
    .replace(/\bMISSING\s+(?:ACCESSORIES|PARTS?|CABLES?|CONNECTORS?|COVERS?|SCREWS?|POWER\s+SUPPLY)\b/gi, ' ')

    // Condition phrases.
    .replace(/\bFOR\s+PARTS?(?:\s+OR\s+NOT\s+WORKING)?\b/gi, ' ')
    .replace(/\bAS\s+IS\b/gi, ' ')
    .replace(/\bNOT\s+WORKING\b/gi, ' ')
    .replace(/\bBROKEN\b/gi, ' ')
    .replace(/\bDAMAGED\b/gi, ' ')
    .replace(/\bDEFECTIVE\b/gi, ' ')
    .replace(/\bFAULTY\b/gi, ' ')
    .replace(/\bUNTESTED\b/gi, ' ')
    .replace(/\bTESTED\s*(?:&|AND)\s*WORKING\b/gi, ' ')
    .replace(/\bTESTED\s+OK\b/gi, ' ')
    .replace(/\bREFURBISHED\b/gi, ' ')

    // Quantity and lot phrases. PCS is removed only when attached to a number.
    .replace(/\bLOT\s+OF\s+\d+\b/gi, ' ')
    .replace(/\bLOT\s*[-:#]?\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s+LOT\b/gi, ' ')
    .replace(/\b\d+\s*(?:PCS?|PIECES?|UNITS?|EA)\b/gi, ' ')

    // Generic condition words.
    .replace(/\bNEW\b/gi, ' ')
    .replace(/\bUSED\b/gi, ' ')

    // Final punctuation and spacing cleanup.
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/^[\s\-|,:;]+/g, '')
    .replace(/[\s\-|,:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCondition(condition: string) {
  const normalized = String(condition || '').toLowerCase();

  if (normalized.includes('refurb')) return 'Refurbished';
  if (normalized.includes('open box')) return 'New – Open box';
  if (normalized.includes('new')) return 'New';
  if (normalized.includes('parts') || normalized.includes('not working')) {
    return 'For parts';
  }
  if (normalized.includes('used')) return 'Used';

  return condition || 'Used';
}

function getRealItemId(itemId: string | null | undefined) {
  const value = String(itemId || '').trim();
  if (!value) return '';

  const parts = value.split('|');
  return parts.length >= 2 && parts[1] ? parts[1] : value;
}

function normalizeOfficialValue(value: unknown) {
  return String(value || '').trim();
}

function isUsableOfficialValue(value: unknown) {
  const normalized = normalizeOfficialValue(value);
  if (!normalized) return false;

  return !/^(DOES NOT APPLY|NOT APPLICABLE|N\/?A|NA|NONE|UNKNOWN|UNBRANDED)$/i.test(
    normalized
  );
}

function getAspectValue(item: any, names: string[]) {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];
  const acceptedNames = new Set(names.map((name) => name.trim().toLowerCase()));

  const aspect = aspects.find((entry: any) =>
    acceptedNames.has(String(entry?.name || '').trim().toLowerCase())
  );

  const value = normalizeOfficialValue(aspect?.value);
  return isUsableOfficialValue(value) ? value : '';
}

function getOfficialBrand(item: any) {
  const itemBrand = normalizeOfficialValue(item?.brand);
  if (isUsableOfficialValue(itemBrand)) return itemBrand;

  const aspectBrand = getAspectValue(item, ['brand']);
  return aspectBrand || 'UNKNOWN';
}

function getOfficialPartNumber(item: any) {
  return getAspectValue(item, ['mpn', 'manufacturer part number']) || 'UNKNOWN';
}

function getOfficialModelNumber(item: any) {
  return getAspectValue(item, ['model', 'model number']) || 'UNKNOWN';
}

function getOfficialGalleryUrls(item: any) {
  const urls = new Set<string>();

  const primary = normalizeOfficialValue(item?.image?.imageUrl);
  if (primary) urls.add(primary);

  for (const image of Array.isArray(item?.additionalImages)
    ? item.additionalImages
    : []) {
    const url = normalizeOfficialValue(image?.imageUrl);
    if (url) urls.add(url);
  }

  for (const image of Array.isArray(item?.thumbnailImages)
    ? item.thumbnailImages
    : []) {
    const url = normalizeOfficialValue(image?.imageUrl);
    if (url) urls.add(url);
  }

  return Array.from(urls);
}

function normalizeEbayItem(item: any, row: any, now: string) {
  const realItemId =
    getRealItemId(item?.itemId) || String(row?.ebay_item_id || '').trim();
  const rawTitle = normalizeOfficialValue(item?.title);

  if (!realItemId || !rawTitle) return null;

  const cleanedName = cleanTitle(rawTitle) || rawTitle;
  const galleryUrls = getOfficialGalleryUrls(item);
  const imageUrl = galleryUrls[0] || null;

  const officialPartNumber = getOfficialPartNumber(item);
  const officialModelNumber = getOfficialModelNumber(item);

  // Same fallback used by the completed full sync:
  // when MPN is missing, use Model as part_number; and vice versa.
  const partNumber =
    officialPartNumber.toUpperCase() === 'UNKNOWN'
      ? officialModelNumber
      : officialPartNumber;

  const modelNumber =
    officialModelNumber.toUpperCase() === 'UNKNOWN'
      ? officialPartNumber
      : officialModelNumber;

  return {
    ebay_item_id: realItemId,
    sku: row?.sku || realItemId,
    part_number: partNumber || 'UNKNOWN',
    model_number: modelNumber || 'UNKNOWN',
    brand: getOfficialBrand(item),
    category: normalizeOfficialValue(item?.categoryPath) || 'Industrial Automation',
    name: cleanedName,
    condition: cleanCondition(normalizeOfficialValue(item?.condition) || 'Used'),
    image_url: imageUrl,
    ebay_image_url: imageUrl,
    ebay_gallery_urls: galleryUrls,
    r2_image_url: null,
    r2_gallery_urls: [],
    image_status: 'pending',
    image_count: galleryUrls.length,
    description: rawTitle,
    slug: slugify(`${realItemId}-${cleanedName}`),
    marketplace: MARKETPLACE,
    seller: 'orbitcontrol',
    source: 'ebay-auto-import',
    source_type: 'ebay',
    quantity: Number.isFinite(row?.quantity) ? row.quantity : 0,
    price: Number.isFinite(row?.price) ? row.price : null,
    currency: row?.currency || 'USD',
    is_active: true,
    catalog_visible: true,
    last_seen_at: now,
    updated_at: now,
  };
}

async function createFeedTask(accessToken: string) {
  const res = await fetch('https://api.ebay.com/sell/feed/v1/inventory_task', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
    },
    body: JSON.stringify({
      feedType: 'LMS_ACTIVE_INVENTORY_REPORT',
      schemaVersion: '1.0',
    }),
  });

  const location = res.headers.get('location');
  const taskId = location?.split('/').pop() || null;

  if (!res.ok || !taskId) {
    throw new Error(`Failed to create feed task: ${res.status}`);
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  const res = await fetch(`https://api.ebay.com/sell/feed/v1/task/${taskId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Failed to check task: ${res.status}`);
  }

  return data?.status || data?.taskStatus || 'UNKNOWN';
}

async function downloadFeedRows(accessToken: string, taskId: string) {
  const res = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${taskId}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to download feed: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files)[0];
  const xml = await zip.files[fileName].async('string');

  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  return blocks
    .map((block) => {
      const ebay_item_id = getTag(block, 'ItemID');
      if (!ebay_item_id) return null;

      const priceMatch = block.match(
        /<Price currencyID="([^"]+)">([^<]+)<\/Price>/
      );

      return {
        ebay_item_id,
        sku: getTag(block, 'SKU'),
        price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
        currency: priceMatch?.[1] || 'USD',
        quantity: Number(getTag(block, 'Quantity') || 0),
      };
    })
    .filter((row): row is any => row !== null)
    .filter((row) => row.currency === 'USD' && row.quantity > 0);
}

async function findMissingRows(rows: any[], limit: number) {
  const missing: any[] = [];

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const ids = chunk.map((row) => String(row.ebay_item_id));

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id')
      .in('ebay_item_id', ids);

    if (error) throw error;

    const existing = new Set(
      (data || []).map((row) => String(row.ebay_item_id))
    );

    for (const row of chunk) {
      if (!existing.has(String(row.ebay_item_id))) {
        missing.push(row);
        if (missing.length >= limit) return missing;
      }
    }
  }

  return missing;
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

  if (!res.ok) return null;
  return res.json();
}

async function ensureJob() {
  const { data } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabaseAdmin
    .from('sync_jobs')
    .insert({
      id: JOB_ID,
      status: 'idle',
      stage: 'idle',
      offset_value: 0,
      batch_size: DEFAULT_LIMIT,
      processed: 0,
      updated: 0,
      failed: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return created;
}

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT),
      MAX_LIMIT
    );

    const now = new Date().toISOString();
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token).trim();

    const job = await ensureJob();

    let taskId = job.feed_task_id as string | null;

    if (!taskId || job.stage === 'idle' || job.stage === 'done') {
      taskId = await createFeedTask(accessToken);

      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'running',
          stage: 'waiting_feed',
          feed_task_id: taskId,
          last_error: null,
          updated_at: now,
          started_at: job.started_at || now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'created_feed_task',
        taskId,
        message: 'Feed task created. Next cron run will check completion.',
      });
    }

    const status = await getTaskStatus(accessToken, taskId);

    if (status !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        stage: 'waiting_feed',
        taskId,
        ebayStatus: status,
      });
    }

    const feedRows = await downloadFeedRows(accessToken, taskId);

    const missingRows = await findMissingRows(feedRows, limit);

    if (!missingRows.length) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'idle',
          stage: 'done',
          feed_task_id: null,
          finished_at: now,
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'done',
        taskId,
        totalActiveFeedItems: feedRows.length,
        imported: 0,
        message: 'No new eBay products found.',
      });
    }

    let inserted = 0;
    let failed = 0;
    const sample: any[] = [];

    for (let i = 0; i < missingRows.length; i += CONCURRENCY) {
      const chunk = missingRows.slice(i, i + CONCURRENCY);

      const details = await Promise.all(
        chunk.map((row) => fetchEbayItem(accessToken, row.ebay_item_id))
      );

      for (let index = 0; index < chunk.length; index++) {
        const row = chunk[index];
        const item = details[index];

        try {
          if (!item?.title) {
            failed++;
            continue;
          }

          const product = normalizeEbayItem(item, row, now);

          if (!product) {
            failed++;
            continue;
          }

          const { error } = await supabaseAdmin
            .from('products')
            .upsert(product, { onConflict: 'ebay_item_id' });

          if (error) throw error;

          inserted++;

          sample.push({
            ebayItemId: product.ebay_item_id,
            brand: product.brand,
            partNumber: product.part_number,
            modelNumber: product.model_number,
            name: product.name,
          });
        } catch (err) {
          failed++;
          sample.push({
            ebayItemId: row.ebay_item_id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'running',
        stage: 'importing',
        processed: (job.processed || 0) + missingRows.length,
        updated: (job.updated || 0) + inserted,
        failed: (job.failed || 0) + failed,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      stage: 'imported_new_products',
      taskId,
      totalActiveFeedItems: feedRows.length,
      checkedNewProducts: missingRows.length,
      inserted,
      failed,
      sample: sample.slice(0, 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
