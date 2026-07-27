import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'ebay-auto-import';
const DEFAULT_LIMIT = 50;
const CONCURRENCY = 8;
const FEED_CHUNK_SIZE = 500;

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
    // حالة المنتج والعلبة
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNO\s+BOX\b/gi, ' ')
    .replace(/\bW\/?O\s+BOX\b/gi, ' ')
    .replace(/\bOPEN\s+BOX\b/gi, ' ')
    .replace(/\bOLD\s+STOCK\b/gi, ' ')

    // الإكسسوارات
    .replace(/\bWITHOUT\s+(?:ANY\s+)?ACCESSORIES\b/gi, ' ')
    .replace(/\bW\/?O\s+ACCESSORIES\b/gi, ' ')

    // حالة التشغيل
    .replace(/\bFOR\s+PARTS(?:\s+OR\s+NOT\s+WORKING)?\b/gi, ' ')
    .replace(/\bNOT\s+WORKING\b/gi, ' ')
    .replace(/\bTESTED\s*(?:&|AND)\s*WORKING\b/gi, ' ')
    .replace(/\bTESTED\s+OK\b/gi, ' ')
    .replace(/\bREFURBISHED\b/gi, ' ')

    // الكميات والـLots
    .replace(/\bLOT\s+OF\s+\d+\b/gi, ' ')
    .replace(/\bLOT\s*[-:#]?\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s*(?:PCS?|PIECES?|UNITS?)\b/gi, ' ')

    // الكلمات العامة
    .replace(/\bNEW\b/gi, ' ')
    .replace(/\bUSED\b/gi, ' ')

    // تنظيف علامات زائدة بعد حذف الكلمات
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/^[\s\-|,:;]+/g, '')
    .replace(/[\s\-|,:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCondition(condition: string) {
  const c = String(condition || '').toLowerCase();

  if (c.includes('refurb')) return 'Refurbished';
  if (c.includes('open box')) return 'New – Open box';
  if (c.includes('new')) return 'New';
  if (c.includes('parts') || c.includes('not working')) return 'For parts';
  if (c.includes('used')) return 'Used';

  return condition || 'Used';
}

function getRealItemId(itemId: string) {
  return String(itemId || '').split('|')[1] || String(itemId || '');
}

function getEbayIdentifiers(item: any, realItemId: string) {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const getAspectValue = (names: string[]) => {
    const normalizedNames = names.map((name) => name.toLowerCase());

    const found = aspects.find((aspect: any) =>
      normalizedNames.includes(
        String(aspect?.name || '')
          .trim()
          .toLowerCase()
      )
    );

    return String(found?.value || '').trim().toUpperCase();
  };

  const isValidEbayValue = (value: string) => {
    const normalized = String(value || '').trim().toUpperCase();

    if (!normalized) return false;

    if (
      /^(DOES NOT APPLY|NOT APPLICABLE|N\/?A|NA|NONE|UNKNOWN|UNBRANDED)$/i.test(
        normalized
      )
    ) {
      return false;
    }

    if (normalized === String(realItemId || '').trim().toUpperCase()) {
      return false;
    }

    if (/^27\d{10}$/.test(normalized)) return false;

    return true;
  };

  const rawMpn = getAspectValue(['mpn', 'manufacturer part number']);
  const rawModel = getAspectValue(['model', 'model number']);

  const ebayMpn = isValidEbayValue(rawMpn) ? rawMpn : '';
  const ebayModel = isValidEbayValue(rawModel) ? rawModel : '';

  return {
    ebayMpn,
    ebayModel,
    partNumber: ebayMpn || ebayModel || 'UNKNOWN',
    modelNumber: ebayModel || 'UNKNOWN',
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

async function findMissingRows(rows: any[], offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, rows.length));
  const end = Math.min(safeOffset + FEED_CHUNK_SIZE, rows.length);
  const chunk = rows.slice(safeOffset, end);

  if (!chunk.length) {
    return {
      missing: [] as any[],
      nextOffset: end,
      finished: true,
      scanned: 0,
      total: rows.length,
    };
  }

  const ids = chunk.map((row) => String(row.ebay_item_id));

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('ebay_item_id')
    .in('ebay_item_id', ids);

  if (error) throw error;

  const existing = new Set(
    (data || []).map((row) => String(row.ebay_item_id))
  );

  const missing = chunk.filter(
    (row) => !existing.has(String(row.ebay_item_id))
  );

  return {
    missing,
    nextOffset: end,
    finished: end >= rows.length,
    scanned: chunk.length,
    total: rows.length,
  };
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
    const now = new Date().toISOString();
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'No eBay access token' },
        { status: 500 }
      );
    }

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
          offset_value: 0,
          processed: 0,
          updated: 0,
          failed: 0,
          last_error: null,
          started_at: now,
          finished_at: null,
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'created_feed_task',
        taskId,
        offset: 0,
        chunkSize: FEED_CHUNK_SIZE,
        message: 'Feed task created. Run the route again to check its status.',
      });
    }

    const status = await getTaskStatus(accessToken, taskId);

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`eBay feed task ${status.toLowerCase()}: ${taskId}`);
    }

    if (status !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        stage: 'waiting_feed',
        taskId,
        ebayStatus: status,
        currentOffset: Number(job.offset_value || 0),
      });
    }

    const feedRows = await downloadFeedRows(accessToken, taskId);
    const currentOffset = Math.max(0, Number(job.offset_value || 0));
    const result = await findMissingRows(feedRows, currentOffset);
    const missingRows = result.missing;

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
            sample.push({
              ebayItemId: row.ebay_item_id,
              error: 'Browse API returned no item title',
            });
            continue;
          }

          const realItemId = getRealItemId(item.itemId) || row.ebay_item_id;
          const title = String(item.title || '').trim();
          const cleanedName = cleanTitle(title);
          const { ebayMpn, ebayModel, partNumber, modelNumber } =
            getEbayIdentifiers(item, realItemId);

          const aspectBrand =
            item.localizedAspects?.find(
              (aspect: any) =>
                String(aspect?.name || '').trim().toLowerCase() === 'brand'
            )?.value || '';

          const brand = detectIndustrialBrand(
            [
              item.brand,
              aspectBrand,
              ebayMpn,
              ebayModel,
              title,
              cleanedName,
            ]
              .filter(Boolean)
              .join(' ')
          );

          const imageUrl =
            item.image?.imageUrl ||
            item.thumbnailImages?.[0]?.imageUrl ||
            item.additionalImages?.[0]?.imageUrl ||
            null;

          const product = {
            ebay_item_id: realItemId,
            sku: realItemId,
            part_number: partNumber,
            model_number: modelNumber,
            brand,
            category: item.categoryPath || 'Industrial Automation',
            name: cleanedName,
            condition: cleanCondition(item.condition || 'Used'),
            image_url: imageUrl,
            ebay_image_url: imageUrl,
            ebay_gallery_urls: [],
            r2_image_url: null,
            r2_gallery_urls: [],
            image_status: 'pending',
            image_count: 0,
            description: title,
            slug: slugify(`${realItemId}-${cleanedName}`),
            marketplace: 'EBAY_US',
            seller: 'orbitcontrol',
            source: 'ebay-auto-import',
            source_type: 'ebay',
            quantity: row.quantity,
            price: row.price,
            currency: row.currency || 'USD',
            is_active: true,
            catalog_visible: true,
            last_seen_at: now,
            updated_at: now,
          };

          const { error } = await supabaseAdmin
            .from('products')
            .upsert(product, { onConflict: 'ebay_item_id' });

          if (error) throw error;

          inserted++;
          sample.push({
            ebayItemId: realItemId,
            brand,
            ebayMpn: ebayMpn || null,
            ebayModel: ebayModel || null,
            partNumber,
            modelNumber,
            title,
          });
        } catch (error) {
          failed++;
          sample.push({
            ebayItemId: row.ebay_item_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: result.finished ? 'idle' : 'running',
        stage: result.finished ? 'done' : 'scanning_feed',
        offset_value: result.finished ? 0 : result.nextOffset,
        processed: Number(job.processed || 0) + result.scanned,
        updated: Number(job.updated || 0) + inserted,
        failed: Number(job.failed || 0) + failed,
        feed_task_id: result.finished ? null : taskId,
        finished_at: result.finished ? now : null,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      stage: result.finished ? 'done' : 'scanning_feed',
      taskId,
      totalActiveFeedItems: result.total,
      scannedThisRun: result.scanned,
      currentOffset,
      nextOffset: result.finished ? 0 : result.nextOffset,
      remaining: Math.max(result.total - result.nextOffset, 0),
      missingInChunk: missingRows.length,
      inserted,
      failed,
      sample: sample.slice(0, 10),
      message: result.finished
        ? 'Feed scan completed.'
        : 'Chunk completed. Run the route again to continue.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
