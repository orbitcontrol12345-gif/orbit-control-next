import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = 'ebay-full-sync';
const MARKETPLACE = 'EBAY_US';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CONCURRENCY = 8;
const DB_PAGE_SIZE = 1000;
const DB_CHUNK_SIZE = 500;

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  price: number | null;
  currency: string;
  quantity: number;
};

type DatabaseProduct = {
  id: number | string;
  ebay_item_id: string | null;
  is_active: boolean | null;
  catalog_visible: boolean | null;
};

type SyncReport = {
  rawFeedRows: number;
  uniqueFeedItems: number;
  databaseProducts: number;
  inserted: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  duplicatesRemoved: number;
  failed: number;
};

type NormalizedEbayItem = {
  ebay_item_id: string;
  sku: string;
  part_number: string;
  model_number: string;
  brand: string;
  category: string;
  name: string;
  condition: string;
  image_url: string | null;
  ebay_image_url: string | null;
  ebay_gallery_urls: string[];
  description: string;
  slug: string;
  marketplace: typeof MARKETPLACE;
  seller: string;
  source: string;
  source_type: string;
  quantity: number;
  price: number | null;
  currency: string;
  is_active: true;
  catalog_visible: true;
  last_seen_at: string;
  updated_at: string;
};

function createEmptyReport(): SyncReport {
  return {
    rawFeedRows: 0,
    uniqueFeedItems: 0,
    databaseProducts: 0,
    inserted: 0,
    updated: 0,
    reactivated: 0,
    deactivated: 0,
    duplicatesRemoved: 0,
    failed: 0,
  };
}


function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const parts = [
      value.message ? `message=${String(value.message)}` : '',
      value.code ? `code=${String(value.code)}` : '',
      value.details ? `details=${String(value.details)}` : '',
      value.hint ? `hint=${String(value.hint)}` : '',
    ].filter(Boolean);

    if (parts.length) return parts.join(' | ');

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown object error';
    }
  }

  return String(error);
}

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function decodeXml(value: string | null) {
  if (!value) return null;

  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return decodeXml(match?.[1]?.trim() || null);
}

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/\bWITH\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNO\s+BOX\b/gi, ' ')
    .replace(/\bW\/?O\s+BOX\b/gi, ' ')
    .replace(/\bOPEN\s+BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+OPEN\s+BOX\b/gi, ' ')
    .replace(/\bORIGINAL\s+BOX\b/gi, ' ')
    .replace(/\bIN\s+BOX\b/gi, ' ')
    .replace(/\bBOXED\b/gi, ' ')
    .replace(/\bBOX\s+ONLY\b/gi, ' ')
    .replace(/\bWITHOUT\s+ORIGINAL\s+BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNO\s+BOX\b/gi, ' ')
    .replace(/\bW\/?O\s+BOX\b/gi, ' ')
    .replace(/\bOPEN\s+BOX\b/gi, ' ')
    .replace(/\bOLD\s+STOCK\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:ANY\s+)?ACCESSORIES\b/gi, ' ')
    .replace(/\bW\/?O\s+ACCESSORIES\b/gi, ' ')
    .replace(/\bFOR\s+PARTS(?:\s+OR\s+NOT\s+WORKING)?\b/gi, ' ')
    .replace(/\bNOT\s+WORKING\b/gi, ' ')
    .replace(/\bTESTED\s*(?:&|AND)\s*WORKING\b/gi, ' ')
    .replace(/\bTESTED\s+OK\b/gi, ' ')
    .replace(/\bREFURBISHED\b/gi, ' ')
    .replace(/\bLOT\s+OF\s+\d+\b/gi, ' ')
    .replace(/\bLOT\s*[-:#]?\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s*(?:PCS?|PIECES?|UNITS?)\b/gi, ' ')
    .replace(/\bNEW\b/gi, ' ')
    .replace(/\bUSED\b/gi, ' ')
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
  return (
    getAspectValue(item, ['mpn', 'manufacturer part number']) || 'UNKNOWN'
  );
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

function normalizeEbayItem(
  item: any,
  feedRow: FeedRow,
  now: string
): NormalizedEbayItem | null {
  const realItemId =
    getRealItemId(item?.itemId) || String(feedRow.ebay_item_id || '').trim();
  const rawTitle = normalizeOfficialValue(item?.title);

  if (!realItemId || !rawTitle) return null;

  const cleanedName = cleanTitle(rawTitle) || rawTitle;
  const galleryUrls = getOfficialGalleryUrls(item);
  const imageUrl = galleryUrls[0] || null;

  return {
    ebay_item_id: realItemId,
    sku: feedRow.sku || realItemId,
    part_number:
  getOfficialPartNumber(item) ||
  getOfficialModelNumber(item) ||
  'UNKNOWN',

model_number:
  getOfficialModelNumber(item) ||
  getOfficialPartNumber(item) ||
  'UNKNOWN',
    brand: getOfficialBrand(item),
    category: normalizeOfficialValue(item?.categoryPath) || 'Industrial Automation',
    name: cleanedName,
    condition: cleanCondition(normalizeOfficialValue(item?.condition) || 'Used'),
    image_url: imageUrl,
    ebay_image_url: imageUrl,
    ebay_gallery_urls: galleryUrls,
    description: rawTitle,
    slug: slugify(`${realItemId}-${cleanedName}`),
    marketplace:
  String(item?.listingMarketplaceId || MARKETPLACE)
    .trim()
    .toUpperCase() as typeof MARKETPLACE,
    seller: 'orbitcontrol',
    source: 'ebay-full-sync',
    source_type: 'ebay',
    quantity: Number.isFinite(feedRow.quantity) ? feedRow.quantity : 0,
    price: Number.isFinite(feedRow.price as number) ? feedRow.price : null,
    currency: feedRow.currency || 'USD',
    is_active: true,
    catalog_visible: true,
    last_seen_at: now,
    updated_at: now,
  };
}

async function createFeedTask(accessToken: string) {
  const response = await fetch(
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
    }
  );

  const location = response.headers.get('location');
  const taskId = location?.split('/').pop() || null;

  if (!response.ok || !taskId) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to create feed task: ${response.status}${body ? ` - ${body}` : ''}`
    );
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Failed to check feed task: ${response.status}`);
  }

  return String(data?.status || data?.taskStatus || 'UNKNOWN').toUpperCase();
}

async function downloadFeedRows(accessToken: string, taskId: string) {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${taskId}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download feed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files).find(
    (name) => !zip.files[name].dir
  );

  if (!fileName) throw new Error('The eBay feed ZIP file is empty.');

  const xml = await zip.files[fileName].async('string');
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/gi) || [];

  const rows: FeedRow[] = [];

  for (const block of blocks) {
    const ebayItemId = getTag(block, 'ItemID');
    if (!ebayItemId) continue;

    const priceMatch = block.match(
      /<Price\s+currencyID="([^"]+)">([^<]+)<\/Price>/i
    );
    const parsedPrice = priceMatch?.[2] ? Number(priceMatch[2]) : null;
    const parsedQuantity = Number(getTag(block, 'Quantity') || 0);

    rows.push({
      ebay_item_id: ebayItemId,
      sku: getTag(block, 'SKU'),
      price:
        parsedPrice !== null && Number.isFinite(parsedPrice)
          ? parsedPrice
          : null,
      currency: priceMatch?.[1] || 'USD',
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
    });
  }

  // The LMS report can contain zero-quantity rows and non-USD rows.
  // Only active US listings that can actually be purchased belong in this sync.
  return rows;
}

function deduplicateFeedRows(rows: FeedRow[]) {
  const uniqueMap = new Map<string, FeedRow>();
  let duplicatesRemoved = 0;

  for (const row of rows) {
    const itemId = String(row.ebay_item_id || '').trim();
    if (!itemId) continue;

    if (uniqueMap.has(itemId)) {
      duplicatesRemoved++;
      continue;
    }

    uniqueMap.set(itemId, { ...row, ebay_item_id: itemId });
  }

  return {
    rows: Array.from(uniqueMap.values()),
    ids: new Set(uniqueMap.keys()),
    duplicatesRemoved,
  };
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
) {
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(
      ebayItemId
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    console.log(
      `[FAILED API] ${ebayItemId} : status=${response.status} body=${errorBody.slice(
        0,
        300
      )}`
    );

    return null;
  }

  const item = await response.json();

  const listingMarketplaceId = String(
  item?.listingMarketplaceId || ''
)
  .trim()
  .toUpperCase();

if (
  listingMarketplaceId !== 'EBAY_US' &&
  listingMarketplaceId !== 'EBAY_MOTORS_US'
) {
  console.log(
    `[FAILED MARKETPLACE] ${ebayItemId} : received=${listingMarketplaceId}`
  );

  return null;
}
  return item;
}
async function ensureJob() {
  const { data, error } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const now = new Date().toISOString();

  const { data: created, error: createError } =
    await supabaseAdmin
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
        last_error: null,
        updated_at: now,
      })
      .select('*')
      .single();

  if (createError) {
    throw createError;
  }

  return created;
}
async function updateJob(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('sync_jobs')
    .update(values)
    .eq('id', JOB_ID);

  if (error) throw error;
}

async function loadAllDatabaseProducts(): Promise<DatabaseProduct[]> {
  const products: DatabaseProduct[] = [];

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const to = from + DB_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,ebay_item_id,is_active,catalog_visible')
      .eq('marketplace', MARKETPLACE)
      .eq('source_type', 'ebay')
      .not('ebay_item_id', 'is', null)
      .range(from, to);

    if (error) throw error;

    const page = (data || []) as DatabaseProduct[];
    products.push(...page);

    if (page.length < DB_PAGE_SIZE) break;
  }

  return products;
}

async function loadDatabaseProductsByIds(ids: string[]) {
  const products: DatabaseProduct[] = [];

  for (let index = 0; index < ids.length; index += DB_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DB_CHUNK_SIZE);
    if (!chunk.length) continue;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,ebay_item_id,is_active,catalog_visible')
      .in('ebay_item_id', chunk);

    if (error) throw error;
    products.push(...((data || []) as DatabaseProduct[]));
  }

  return products;
}

async function insertProducts(products: NormalizedEbayItem[]) {
  if (!products.length) return;

  for (let index = 0; index < products.length; index += 100) {
    const chunk = products.slice(index, index + 100).map((product) => ({
      ...product,
      r2_image_url: null,
      r2_gallery_urls: [],
      image_status: 'pending',
      image_count: product.ebay_gallery_urls.length,
    }));

    const { error } = await supabaseAdmin.from('products').insert(chunk);
    if (error) {
      throw new Error(`Insert products failed: ${formatError(error)}`);
    }
  }
}

async function updateProducts(products: NormalizedEbayItem[]) {
  if (!products.length) return;

  const updateRows = products.map((product) => ({
    ebay_item_id: product.ebay_item_id,
    sku: product.sku,
    part_number: product.part_number,
    model_number: product.model_number,
    brand: product.brand,
    category: product.category,
    name: product.name,
    condition: product.condition,
    image_url: product.image_url,
    ebay_image_url: product.ebay_image_url,
    ebay_gallery_urls: product.ebay_gallery_urls,
    image_count: product.ebay_gallery_urls.length,
    description: product.description,
    slug: product.slug,
    marketplace: product.marketplace,
    seller: product.seller,
    source: product.source,
    source_type: product.source_type,
    quantity: product.quantity,
    price: product.price,
    currency: product.currency,
    is_active: true,
    catalog_visible: true,
    last_seen_at: product.last_seen_at,
    updated_at: product.updated_at,
  }));

  for (let index = 0; index < updateRows.length; index += 100) {
    const chunk = updateRows.slice(index, index + 100);
    const { error } = await supabaseAdmin
      .from('products')
      .upsert(chunk, { onConflict: 'ebay_item_id' });

    if (error) {
      throw new Error(`Update products failed: ${formatError(error)}`);
    }
  }
}

async function deactivateMissingProducts(
  databaseProducts: DatabaseProduct[],
  feedIds: Set<string>,
  now: string
) {
  const idsToDeactivate = databaseProducts
    .filter((product) => {
      const itemId = String(product.ebay_item_id || '').trim();
      if (!itemId || feedIds.has(itemId)) return false;

      return product.is_active !== false || product.catalog_visible !== false;
    })
    .map((product) => String(product.ebay_item_id));

  for (let index = 0; index < idsToDeactivate.length; index += DB_CHUNK_SIZE) {
    const chunk = idsToDeactivate.slice(index, index + DB_CHUNK_SIZE);

    const { error } = await supabaseAdmin
      .from('products')
      .update({
        is_active: false,
        catalog_visible: false,
        updated_at: now,
      })
      .in('ebay_item_id', chunk);

    if (error) throw error;
  }

  return idsToDeactivate.length;
}

function getSafeLimit(req: NextRequest) {
  const requested = Number(
    req.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT
  );

  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(requested), MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  const report = createEmptyReport();

  try {
    const limit = getSafeLimit(req);
    const now = new Date().toISOString();
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) throw new Error('eBay access token is empty.');

    const job = await ensureJob();
    let taskId = job.feed_task_id as string | null;
    const currentStage = String(job.stage || 'idle');

    if (!taskId || currentStage === 'idle' || currentStage === 'done') {
      taskId = await createFeedTask(accessToken);

      await updateJob({
        status: 'running',
        stage: 'waiting_feed',
        feed_task_id: taskId,
        offset_value: 0,
        batch_size: limit,
        processed: 0,
        updated: 0,
        failed: 0,
        last_error: null,
        started_at: now,
        finished_at: null,
        updated_at: now,
      });

      return NextResponse.json({
        success: true,
        stage: 'created_feed_task',
        taskId,
        report,
        message: 'Feed task created. The next run will check its status.',
      });
    }

    const feedStatus = await getTaskStatus(accessToken, taskId);

    if (feedStatus !== 'COMPLETED') {
      if (['FAILED', 'ABORTED', 'CANCELLED'].includes(feedStatus)) {
        throw new Error(`eBay feed task ended with status: ${feedStatus}`);
      }

      await updateJob({
        status: 'running',
        stage: 'waiting_feed',
        updated_at: now,
      });

      return NextResponse.json({
        success: true,
        stage: 'waiting_feed',
        taskId,
        ebayStatus: feedStatus,
        report,
      });
    }

    const rawFeedRows = await downloadFeedRows(accessToken, taskId);
    const deduplicated = deduplicateFeedRows(rawFeedRows);

const uniqueFeedRows = deduplicated.rows.filter(
  (row) => row.quantity > 0
);

    report.rawFeedRows = rawFeedRows.length;
    report.uniqueFeedItems = uniqueFeedRows.length;
    report.duplicatesRemoved = deduplicated.duplicatesRemoved;

    const databaseProducts = await loadAllDatabaseProducts();
    report.databaseProducts = databaseProducts.length;

    if (currentStage === 'deactivating') {
      report.deactivated = await deactivateMissingProducts(
  databaseProducts,
  new Set(uniqueFeedRows.map((row) => row.ebay_item_id)),
  now
);

      await updateJob({
        status: 'idle',
        stage: 'done',
        feed_task_id: null,
        offset_value: 0,
        finished_at: now,
        updated_at: now,
      });

      return NextResponse.json({
        success: true,
        stage: 'done',
        taskId,
        report,
        message: 'Full eBay synchronization completed.',
      });
    }

    const offset = Math.max(0, Number(job.offset_value || 0));

    if (offset >= uniqueFeedRows.length) {
      await updateJob({
        status: 'running',
        stage: 'deactivating',
        updated_at: now,
      });

      return NextResponse.json({
        success: true,
        stage: 'ready_to_deactivate',
        taskId,
        nextOffset: offset,
        report,
        message:
          'All feed items were processed. The next run will deactivate missing products.',
      });
    }

    const batch = uniqueFeedRows.slice(offset, offset + limit);
    const batchIds = batch.map((row) => row.ebay_item_id);
    const existingBatchProducts = await loadDatabaseProductsByIds(batchIds);
    const existingMap = new Map(
      existingBatchProducts.map((product) => [
        String(product.ebay_item_id),
        product,
      ])
    );

    const normalizedItems: NormalizedEbayItem[] = [];

    for (let index = 0; index < batch.length; index += CONCURRENCY) {
  const chunk = batch.slice(index, index + CONCURRENCY);

  const details = await Promise.all(
    chunk.map((row) =>
      fetchEbayItem(accessToken, row.ebay_item_id)
    )
  );

  for (
    let itemIndex = 0;
    itemIndex < chunk.length;
    itemIndex++
  ) {
    const feedRow = chunk[itemIndex];
    const ebayItem = details[itemIndex];

    if (!ebayItem) {
      console.log(
        `[FAILED] ${feedRow.ebay_item_id} : Browse API returned null`
      );

      report.failed++;
      continue;
    }

    const normalized = normalizeEbayItem(
      ebayItem,
      feedRow,
      now
    );

    if (!normalized) {
      console.log(
        `[FAILED] ${feedRow.ebay_item_id} : normalizeEbayItem returned null`
      );

      report.failed++;
      continue;
    }

    normalizedItems.push(normalized);
  }
}
    const itemsToInsert: NormalizedEbayItem[] = [];
    const itemsToUpdate: NormalizedEbayItem[] = [];

    for (const item of normalizedItems) {
      const existing = existingMap.get(item.ebay_item_id);

      if (!existing) {
        itemsToInsert.push(item);
        continue;
      }

      itemsToUpdate.push(item);

      if (existing.is_active === false || existing.catalog_visible === false) {
        report.reactivated++;
      }
    }

    try {
      await insertProducts(itemsToInsert);
      report.inserted = itemsToInsert.length;
    } catch (error) {
      report.failed += itemsToInsert.length;
      throw error;
    }

    try {
      await updateProducts(itemsToUpdate);
      report.updated = itemsToUpdate.length;
    } catch (error) {
      report.failed += itemsToUpdate.length;
      throw error;
    }

    const nextOffset = offset + batch.length;
    const hasMoreItems = nextOffset < uniqueFeedRows.length;

    await updateJob({
      status: 'running',
      stage: hasMoreItems ? 'syncing' : 'deactivating',
      offset_value: nextOffset,
      batch_size: limit,
      processed: Number(job.processed || 0) + batch.length,
      updated:
        Number(job.updated || 0) + report.inserted + report.updated,
      failed: Number(job.failed || 0) + report.failed,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      stage: hasMoreItems ? 'syncing' : 'feed_processing_completed',
      taskId,
      offset,
      nextOffset,
      remaining: Math.max(0, uniqueFeedRows.length - nextOffset),
      report,
      message: hasMoreItems
        ? 'The current synchronization batch completed.'
        : 'All feed items were processed. The next run will deactivate missing products.',
    });
  } catch (error) {
    const message = formatError(error);

try {
  await updateJob({
    status: 'failed',
    last_error: message,
    updated_at: new Date().toISOString(),
  });
} catch (updateError) {
  console.error(
    'Failed to update the synchronization job:',
    updateError
  );
}

return NextResponse.json(
  {
    success: false,
    error: message,
  },
  { status: 500 }
);
  }
}
