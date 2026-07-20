import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'ebay-auto-import';
const DEFAULT_LIMIT = 50;
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

function getBestPartNumber(
  item: any,
  title: string,
  realItemId: string
): string {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const invalidValues = new Set([
    '',
    'UNKNOWN',
    'UNBRANDED',
    'DOES NOT APPLY',
    'DOES NOT APPLY.',
    'NOT APPLICABLE',
    'N/A',
    'NA',
    'NONE',
    'NO',
    'OTHER',
  ]);

  function cleanCandidate(value: unknown): string {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^["'([{]+|["'\])}]+$/g, '')
      .replace(/\s+/g, ' ');
  }

  function isValidPartNumber(value: string): boolean {
  const normalized = cleanCandidate(value);
  const compact = normalized.replace(/\s+/g, '-');

  if (!normalized) return false;
  if (invalidValues.has(normalized)) return false;

  // يمنع رقم منتج eBay
  if (normalized === String(realItemId).toUpperCase()) return false;
  if (/^27\d{10}$/.test(normalized)) return false;
  if (/^\d{12,13}$/.test(normalized)) return false;

  // يمنع القيم العامة
  if (
    /^(NEW|USED|REFURBISHED|OPEN BOX|LOT|PCS?|PART NUMBER)$/i.test(
      normalized
    )
  ) {
    return false;
  }

  // يمنع قيمًا مثل MODEL 550 وREV 02 وNO 857822
  if (
    /^(REV|REVISION|VER|VERSION|MODEL|TYPE|NO|NUMBER|ART|ARTICLE|CAT|CATALOG|REF|REFERENCE|ORDER|SERIAL|SN|LOT|QTY)[\s\-/.]+[A-Z0-9.]+$/i.test(
      normalized
    )
  ) {
    return false;
  }

  // يمنع أوصافًا مثل 8 CHANNEL و16 PORT
  if (
    /^\d+[\s\-]*(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?|INPUTS?|OUTPUTS?)$/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /^(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?|INPUTS?|OUTPUTS?)[\s\-]*\d+$/i.test(
      normalized
    )
  ) {
    return false;
  }

  // يمنع الفولتية والتردد والقدرة
  if (
    /^\d+(?:\.\d+)?\s*(VAC|VDC|AC|DC|V|HZ|KHZ|MHZ|KW|W|AMP|AMPS|A|MA)$/i.test(
      normalized
    )
  ) {
    return false;
  }

  // يجب أن يحتوي على رقم واحد على الأقل
  if (!/\d/.test(normalized)) return false;

  // يمنع الجمل الطويلة
  if (normalized.length > 80) return false;
  if (normalized.split(/\s+/).length > 5) return false;

  // فحص إضافي بعد تحويل المسافات إلى شرطات
  if (
    /^(REV|REVISION|VER|VERSION|MODEL|TYPE|NO|NUMBER)-[A-Z0-9.]+$/i.test(
      compact
    )
  ) {
    return false;
  }

  return true;
}

  function getAspectValue(names: string[]): string {
    for (const name of names) {
      const found = aspects.find(
        (aspect: any) =>
          String(aspect?.name || '').trim().toLowerCase() ===
          name.toLowerCase()
      );

      const value = cleanCandidate(found?.value);

      if (isValidPartNumber(value)) {
        return value;
      }
    }

    return '';
  }

  // الأولوية للبيانات المكتوبة يدويًا في eBay
  const ebayPartNumber = getAspectValue([
    'MPN',
    'Manufacturer Part Number',
    'Part Number',
    'Model Number',
    'Model',
  ]);

  if (ebayPartNumber) {
    return ebayPartNumber;
  }

  // الاستخراج من العنوان فقط عند عدم وجود MPN صالح
  const extracted = cleanCandidate(extractPartNumber(title));

  if (isValidPartNumber(extracted)) {
    return extracted;
  }

  return 'UNKNOWN';
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
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT),
      100
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

let unknownBrand = 0;
let unknownPartNumber = 0;
let missingImage = 0;
let uncategorized = 0;

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

          const realItemId = getRealItemId(item.itemId) || row.ebay_item_id;
          const title = String(item.title || '').trim();
          const cleanedName = cleanTitle(title);
          const partNumber = getBestPartNumber(item, title, realItemId);

          const aspectBrand =
  item.localizedAspects?.find(
    (a: any) => String(a.name || '').trim().toLowerCase() === 'brand'
  )?.value || '';

const ebayBrand = String(item.brand || aspectBrand || '').trim();

const brand = ebayBrand || detectIndustrialBrand(title);
          const imageUrl =
            item.image?.imageUrl ||
            item.thumbnailImages?.[0]?.imageUrl ||
            item.additionalImages?.[0]?.imageUrl ||
            null;
const category =
  item.categoryPath || 'Industrial Automation';

if (!brand || brand.toUpperCase() === 'UNKNOWN') {
  unknownBrand++;
}

if (!partNumber || partNumber === 'UNKNOWN') {
  unknownPartNumber++;
}

if (!imageUrl) {
  missingImage++;
}

if (
  !category ||
  category === 'Industrial Automation' ||
  category.toUpperCase() === 'UNCATEGORIZED'
) {
  uncategorized++;
}
          const product = {
            ebay_item_id: realItemId,
            sku: realItemId,
            part_number: partNumber,
            model_number: partNumber,
            brand,
            category,
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
            partNumber,
            title,
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
