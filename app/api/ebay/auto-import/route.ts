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
const DATABASE_LOOKUP_CHUNK_SIZE = 500;
const BROWSE_TIMEOUT_MS = 20_000;
const FEED_TIMEOUT_MS = 60_000;
const MAX_FETCH_ATTEMPTS = 2;

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  price: number | null;
  currency: string;
  quantity: number;
};

type ImportSample = {
  ebayItemId: string;
  brand?: string;
  partNumber?: string;
  modelNumber?: string;
  name?: string;
  error?: string;
};

const BRAND_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'ABB', aliases: ['ABB'] },
  { canonical: 'Allen-Bradley', aliases: ['ALLEN-BRADLEY', 'ALLEN BRADLEY'] },
  { canonical: 'Danfoss', aliases: ['DANFOSS'] },
  { canonical: 'Endress+Hauser', aliases: ['ENDRESS+HAUSER', 'ENDRESS HAUSER'] },
  { canonical: 'Festo', aliases: ['FESTO'] },
  { canonical: 'Finder', aliases: ['FINDER'] },
  { canonical: 'Honeywell', aliases: ['HONEYWELL'] },
  { canonical: 'ifm', aliases: ['IFM', 'IFM ELECTRONIC'] },
  { canonical: 'Keyence', aliases: ['KEYENCE'] },
  { canonical: 'Lutron', aliases: ['LUTRON'] },
  { canonical: 'Mitsubishi Electric', aliases: ['MITSUBISHI ELECTRIC', 'MITSUBISHI'] },
  { canonical: 'Omron', aliases: ['OMRON'] },
  { canonical: 'Pepperl+Fuchs', aliases: ['PEPPERL+FUCHS', 'PEPPERL FUCHS'] },
  { canonical: 'Phoenix Contact', aliases: ['PHOENIX CONTACT'] },
  { canonical: 'Pilz', aliases: ['PILZ'] },
  { canonical: 'Schneider Electric', aliases: ['SCHNEIDER ELECTRIC', 'SCHNEIDER'] },
  { canonical: 'Siemens', aliases: ['SIEMENS'] },
  { canonical: 'SMC', aliases: ['SMC'] },
  { canonical: 'WAGO', aliases: ['WAGO'] },
  { canonical: 'Yokogawa', aliases: ['YOKOGAWA'] },
];

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getTag(xml: string, tag: string) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  );

  return match?.[1] ? decodeXmlEntities(match[1].trim()) : null;
}

function cleanTitle(title: string) {
  return String(title || '')
    // Packaging phrases only — never remove a meaningful standalone "box".
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?(?:OLD\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+OLD\s+BOX\b/gi, ' ')
    .replace(
      /\bWITH\s+(?:THE\s+)?(?:OLD\s+|ORIGINAL\s+|DAMAGED\s+|FILTHY\s+)?BOX\b/gi,
      ' '
    )
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
    .replace(
      /\bMISSING\s+(?:ACCESSORIES|PARTS?|CABLES?|CONNECTORS?|COVERS?|SCREWS?|POWER\s+SUPPLY)\b/gi,
      ' '
    )

    // Condition phrases.
    .replace(/\bFOR\s+PARTS?(?:\s+OR\s+NOT\s+WORKING)?\b/gi, ' ')
    .replace(/\bAS[\s-]+IS\b/gi, ' ')
    .replace(/\bNOT\s+WORKING\b/gi, ' ')
    .replace(/\bBROKEN\b/gi, ' ')
    .replace(/\bDAMAGED\b/gi, ' ')
    .replace(/\bDEFECTIVE\b/gi, ' ')
    .replace(/\bFAULTY\b/gi, ' ')
    .replace(/\bUNTESTED\b/gi, ' ')
    .replace(/\bTESTED\s*(?:&|AND)\s*WORKING\b/gi, ' ')
    .replace(/\bTESTED\s+OK\b/gi, ' ')
    .replace(/\bREFURBISHED\b/gi, ' ')

    // Quantity and lot phrases.
    .replace(/\bLOT\s+OF\s+\d+\b/gi, ' ')
    .replace(/\bLOT\s*[-:#]?\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s+LOT\b/gi, ' ')
    .replace(/\b\d+\s*(?:PCS?|PIECES?|UNITS?|EA)\b/gi, ' ')

    // Remove repeated non-descriptive quantity words only at the beginning.
    .replace(
      /^(?:(?:LOT|LOTS|PCS?|PIECES?|UNITS?|EA)\b[\s:,.\-#/]*)+/gi,
      ' '
    )

    // Generic condition words.
    .replace(/\bNEW\b/gi, ' ')
    .replace(/\bUSED\b/gi, ' ')

    // Run the leading quantity cleanup again in case NEW/USED preceded it.
    .replace(
      /^(?:(?:LOT|LOTS|PCS?|PIECES?|UNITS?|EA)\b[\s:,.\-#/]*)+/gi,
      ' '
    )

    // Final punctuation and spacing cleanup.
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[\s\-|,:;.#/]+/g, '')
    .replace(/[\s\-|,:;.#/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCondition(condition: string) {
  const normalized = String(condition || '').trim().toLowerCase();

  if (normalized.includes('refurb')) return 'Refurbished';
  if (normalized.includes('open box')) return 'New – Open box';
  if (
    normalized.includes('parts') ||
    normalized.includes('not working') ||
    normalized.includes('for repair')
  ) {
    return 'For parts';
  }
  if (normalized.includes('new')) return 'New';
  if (normalized.includes('used') || normalized.includes('pre-owned')) {
    return 'Used';
  }

  return condition || 'Used';
}

function getRealItemId(itemId: string | null | undefined) {
  const value = String(itemId || '').trim();
  if (!value) return '';

  const parts = value.split('|');
  return parts.length >= 2 && parts[1] ? parts[1] : value;
}

function normalizeOfficialValue(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isUsableOfficialValue(value: unknown) {
  const normalized = normalizeOfficialValue(value);
  if (!normalized) return false;

  return !/^(DOES NOT APPLY|NOT APPLICABLE|N\/?A|NA|NONE|UNKNOWN|UNBRANDED|NO BRAND|GENERIC)$/i.test(
    normalized
  );
}

function normalizeBrandKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function canonicalizeBrand(value: unknown) {
  const brand = normalizeOfficialValue(value);
  if (!isUsableOfficialValue(brand)) return '';

  const key = normalizeBrandKey(brand);

  for (const entry of BRAND_ALIASES) {
    if (entry.aliases.some((alias) => normalizeBrandKey(alias) === key)) {
      return entry.canonical;
    }
  }

  // Preserve eBay's official spelling for brands outside our known alias list.
  return brand;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectKnownBrandFromTitle(title: string) {
  const normalizedTitle = normalizeOfficialValue(title).toUpperCase();

  for (const entry of BRAND_ALIASES) {
    for (const alias of entry.aliases) {
      const escapedAlias = escapeRegExp(alias.toUpperCase()).replace(
        /\s+/g,
        '\\s+'
      );
      const pattern = new RegExp(
        `(?:^|[^A-Z0-9])${escapedAlias}(?=$|[^A-Z0-9])`,
        'i'
      );

      if (pattern.test(normalizedTitle)) return entry.canonical;
    }
  }

  return '';
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
  const directBrand = canonicalizeBrand(item?.brand);
  if (directBrand) return directBrand;

  const aspectBrand = canonicalizeBrand(getAspectValue(item, ['brand']));
  if (aspectBrand) return aspectBrand;

  // Conservative fallback: only match brands from the explicit alias list.
  return detectKnownBrandFromTitle(item?.title) || 'UNKNOWN';
}

function normalizeIdentifier(value: unknown) {
  const normalized = normalizeOfficialValue(value);
  if (!isUsableOfficialValue(normalized)) return 'UNKNOWN';
  return normalized.toUpperCase();
}

function getOfficialPartNumber(item: any) {
  return normalizeIdentifier(
    getAspectValue(item, ['mpn', 'manufacturer part number', 'part number'])
  );
}

function getOfficialModelNumber(item: any) {
  return normalizeIdentifier(
    getAspectValue(item, ['model', 'model number', 'model no'])
  );
}

function getOfficialGalleryUrls(item: any) {
  const urls = new Set<string>();

  const addUrl = (value: unknown) => {
    const url = normalizeOfficialValue(value);
    if (/^https?:\/\//i.test(url)) urls.add(url);
  };

  addUrl(item?.image?.imageUrl);

  for (const image of Array.isArray(item?.additionalImages)
    ? item.additionalImages
    : []) {
    addUrl(image?.imageUrl);
  }

  for (const image of Array.isArray(item?.thumbnailImages)
    ? item.thumbnailImages
    : []) {
    addUrl(image?.imageUrl);
  }

  return Array.from(urls);
}

function toFiniteNumber(value: unknown, fallback: number | null) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeEbayItem(item: any, row: FeedRow, now: string) {
  const realItemId =
    getRealItemId(item?.itemId) || String(row?.ebay_item_id || '').trim();
  const rawTitle = normalizeOfficialValue(item?.title);

  if (!realItemId || !rawTitle) return null;

  const cleanedName = cleanTitle(rawTitle) || rawTitle;
  const galleryUrls = getOfficialGalleryUrls(item);
  const imageUrl = galleryUrls[0] || null;

  const officialPartNumber = getOfficialPartNumber(item);
  const officialModelNumber = getOfficialModelNumber(item);

  // If one official identifier is missing, use the other as a safe fallback.
  const partNumber =
    officialPartNumber === 'UNKNOWN'
      ? officialModelNumber
      : officialPartNumber;

  const modelNumber =
    officialModelNumber === 'UNKNOWN'
      ? officialPartNumber
      : officialModelNumber;

  return {
    ebay_item_id: realItemId,
    sku: normalizeOfficialValue(row?.sku) || realItemId,
    part_number: partNumber || 'UNKNOWN',
    model_number: modelNumber || 'UNKNOWN',
    brand: getOfficialBrand(item),
    category:
      normalizeOfficialValue(item?.categoryPath) || 'Industrial Automation',
    name: cleanedName,
    condition: cleanCondition(
      normalizeOfficialValue(item?.condition) || 'Used'
    ),
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
    quantity: toFiniteNumber(row?.quantity, 0) ?? 0,
    price: toFiniteNumber(row?.price, null),
    currency: normalizeOfficialValue(row?.currency) || 'USD',
    is_active: true,
    catalog_visible: true,
    last_seen_at: now,
    updated_at: now,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getResponseError(res: Response) {
  const body = await res.text().catch(() => '');
  const compactBody = body.replace(/\s+/g, ' ').trim().slice(0, 500);
  return compactBody || res.statusText || 'Unknown eBay API error';
}

async function createFeedTask(accessToken: string) {
  const res = await fetchWithTimeout(
    'https://api.ebay.com/sell/feed/v1/inventory_task',
    {
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
    },
    FEED_TIMEOUT_MS
  );

  const location = res.headers.get('location');
  const taskId = location?.split('/').filter(Boolean).pop() || null;

  if (!res.ok || !taskId) {
    const detail = await getResponseError(res);
    throw new Error(`Failed to create feed task (${res.status}): ${detail}`);
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  const res = await fetchWithTimeout(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    },
    BROWSE_TIMEOUT_MS
  );

  if (!res.ok) {
    const detail = await getResponseError(res);
    throw new Error(`Failed to check feed task (${res.status}): ${detail}`);
  }

  const data = await res.json().catch(() => null);
  return String(data?.status || data?.taskStatus || 'UNKNOWN').toUpperCase();
}

async function downloadFeedRows(accessToken: string, taskId: string) {
  const res = await fetchWithTimeout(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(
      taskId
    )}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    },
    FEED_TIMEOUT_MS
  );

  if (!res.ok) {
    const detail = await getResponseError(res);
    throw new Error(`Failed to download feed (${res.status}): ${detail}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files).find(
    (name) => !zip.files[name].dir
  );

  if (!fileName) {
    throw new Error('The downloaded eBay feed ZIP does not contain a file.');
  }

  const xml = await zip.files[fileName].async('string');
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/gi) || [];

  return blocks
    .map((block): FeedRow | null => {
      const ebayItemId = getTag(block, 'ItemID');
      if (!ebayItemId) return null;

      const priceMatch = block.match(
        /<Price\s+currencyID=["']([^"']+)["'][^>]*>([^<]+)<\/Price>/i
      );
      const price = toFiniteNumber(priceMatch?.[2], null);
      const quantity = toFiniteNumber(getTag(block, 'Quantity'), 0) ?? 0;

      return {
        ebay_item_id: ebayItemId,
        sku: getTag(block, 'SKU'),
        price,
        currency: normalizeOfficialValue(priceMatch?.[1]) || 'USD',
        quantity,
      };
    })
    .filter((row): row is FeedRow => row !== null)
    .filter(
      (row) => row.currency.toUpperCase() === 'USD' && row.quantity > 0
    );
}

async function findMissingRows(rows: FeedRow[], limit: number) {
  const missing: FeedRow[] = [];

  for (let i = 0; i < rows.length; i += DATABASE_LOOKUP_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DATABASE_LOOKUP_CHUNK_SIZE);
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
  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(ebayItemId)}`;

  let lastError = 'Unknown Browse API error';

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
            'Accept-Language': 'en-US',
          },
        },
        BROWSE_TIMEOUT_MS
      );

      if (res.ok) return await res.json();

      lastError = `Browse API ${res.status}: ${await getResponseError(res)}`;

      // Do not retry permanent client-side errors, except rate limiting.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw new Error(lastError);
}

async function ensureJob() {
  const { data, error: selectError } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (selectError) throw selectError;
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

function getSafeLimit(req: NextRequest) {
  const requested = Number(req.nextUrl.searchParams.get('limit'));

  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT);
}

async function updateJob(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('sync_jobs')
    .update(values)
    .eq('id', JOB_ID);

  if (error) throw error;
}

export async function GET(req: NextRequest) {
  try {
    const limit = getSafeLimit(req);
    const now = new Date().toISOString();
    const tokenResult = await getEbayToken();
    const accessToken = normalizeOfficialValue(tokenResult?.access_token);

    if (!accessToken) {
      throw new Error('eBay access token is missing.');
    }

    const job = await ensureJob();
    let taskId = normalizeOfficialValue(job.feed_task_id) || null;

    if (!taskId || job.stage === 'idle' || job.stage === 'done') {
      taskId = await createFeedTask(accessToken);

      await updateJob({
        status: 'running',
        stage: 'waiting_feed',
        feed_task_id: taskId,
        last_error: null,
        batch_size: limit,
        updated_at: now,
        started_at: job.started_at || now,
      });

      return NextResponse.json({
        success: true,
        stage: 'created_feed_task',
        taskId,
        message: 'Feed task created. Next cron run will check completion.',
      });
    }

    const status = await getTaskStatus(accessToken, taskId);

    if (['FAILED', 'CANCELED', 'CANCELLED'].includes(status)) {
      await updateJob({
        status: 'error',
        stage: 'idle',
        feed_task_id: null,
        last_error: `eBay feed task ended with status: ${status}`,
        updated_at: now,
      });

      return NextResponse.json(
        {
          success: false,
          stage: 'feed_task_failed',
          taskId,
          ebayStatus: status,
          error: `eBay feed task ended with status: ${status}`,
        },
        { status: 502 }
      );
    }

    if (!status.startsWith('COMPLETED')) {
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
      await updateJob({
        status: 'idle',
        stage: 'done',
        feed_task_id: null,
        finished_at: now,
        updated_at: now,
      });

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
    const sample: ImportSample[] = [];

    for (let i = 0; i < missingRows.length; i += CONCURRENCY) {
      const chunk = missingRows.slice(i, i + CONCURRENCY);
      const details = await Promise.allSettled(
        chunk.map((row) => fetchEbayItem(accessToken, row.ebay_item_id))
      );

      for (let index = 0; index < chunk.length; index++) {
        const row = chunk[index];
        const detail = details[index];

        try {
          if (detail.status === 'rejected') throw detail.reason;

          const item = detail.value;
          if (!item?.title) {
            throw new Error('eBay Browse API returned an item without a title.');
          }

          const product = normalizeEbayItem(item, row, now);
          if (!product) {
            throw new Error('Unable to normalize the eBay item.');
          }

          const { error } = await supabaseAdmin
            .from('products')
            .upsert(product, { onConflict: 'ebay_item_id' });

          if (error) throw error;

          inserted++;

          if (sample.length < 10) {
            sample.push({
              ebayItemId: product.ebay_item_id,
              brand: product.brand,
              partNumber: product.part_number,
              modelNumber: product.model_number,
              name: product.name,
            });
          }
        } catch (error) {
          failed++;

          if (sample.length < 10) {
            sample.push({
              ebayItemId: row.ebay_item_id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    await updateJob({
      status: 'running',
      stage: 'importing',
      processed: (job.processed || 0) + missingRows.length,
      updated: (job.updated || 0) + inserted,
      failed: (job.failed || 0) + failed,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      stage: 'imported_new_products',
      taskId,
      totalActiveFeedItems: feedRows.length,
      checkedNewProducts: missingRows.length,
      inserted,
      failed,
      hasMoreNewProducts: missingRows.length >= limit,
      sample,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'error',
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', JOB_ID);
    } catch {
      // Preserve the original error if updating sync_jobs also fails.
    }

    return NextResponse.json(
      {
        success: false,
        stage: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}
