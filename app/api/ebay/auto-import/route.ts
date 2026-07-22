import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';
import { cleanProductName } from '@/lib/product-name';
import { detectCategory } from '@/lib/category-detector';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'ebay-auto-import';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CONCURRENCY = 1;

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  quantity: number;
};

type ExistingProduct = {
  id: string;
  ebay_item_id: string | null;
  sku: string | null;

  part_number: string | null;
  model_number: string | null;

  brand: string | null;
  category: string | null;
  name: string | null;
  condition: string | null;
  description: string | null;

  image_url: string | null;
  ebay_image_url: string | null;
  ebay_gallery_urls: string[] | null;

  r2_image_url: string | null;
  r2_gallery_urls: string[] | null;

  image_status: string | null;
  image_count: number | null;

  seller: string | null;
  source: string | null;
  source_type: string | null;
  marketplace: string | null;

  slug: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function getTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's')
  );

  return match?.[1]?.trim() || null;
}

function getRealItemId(itemId: unknown): string {
  const value = normalizeText(itemId);

  if (!value) return '';

  const parts = value.split('|');

  return parts[1] || value;
}

function cleanCondition(condition: unknown): string {
  const value = normalizeText(condition);
  const normalized = value.toLowerCase();

  /*
   * يجب فحص For Parts قبل New وUsed، لأن بعض نصوص eBay
   * قد تحتوي على أكثر من كلمة تخص الحالة.
   */
  if (
    normalized.includes('for parts') ||
    normalized.includes('not working') ||
    normalized.includes('parts only') ||
    normalized.includes('spares or repair')
  ) {
    return 'For parts';
  }

  if (
    normalized.includes('seller refurbished') ||
    normalized.includes('manufacturer refurbished') ||
    normalized.includes('certified refurbished') ||
    normalized.includes('refurb')
  ) {
    return 'Refurbished';
  }

  if (
    normalized.includes('open box') ||
    normalized.includes('new other')
  ) {
    return 'New – Open box';
  }

  if (
    normalized.includes('new without box') ||
    normalized.includes('new no box')
  ) {
    return 'New Without Box';
  }

  if (normalized.includes('new')) {
    return 'New';
  }

  if (
    normalized.includes('pre-owned') ||
    normalized.includes('preowned') ||
    normalized.includes('used')
  ) {
    return 'Used';
  }

  return value || 'Used';
}

function isUnknownValue(value: unknown): boolean {
  const normalized = normalizeUpper(value);

  return new Set([
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
  ]).has(normalized);
}

function isManualProduct(
  product: ExistingProduct | undefined
): boolean {
  if (!product) return false;

  const source = normalizeText(product.source).toLowerCase();
  const sourceType = normalizeText(product.source_type).toLowerCase();

  return (
    source === 'manual' ||
    sourceType === 'manual' ||
    source.includes('manual') ||
    sourceType.includes('manual')
  );
}

function normalizeUrlArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
}

function sameStringArray(
  first: string[] | null | undefined,
  second: string[] | null | undefined
): boolean {
  const a = normalizeUrlArray(first);
  const b = normalizeUrlArray(second);

  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
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

    /*
     * ممنوع استخدام eBay Item ID كرقم قطعة.
     */
    if (
      normalized === normalizeUpper(realItemId)
    ) {
      return false;
    }

    if (/^27\d{10}$/.test(normalized)) {
      return false;
    }

    if (/^\d{12,13}$/.test(normalized)) {
      return false;
    }

    /*
     * يمنع الكلمات العامة من أن تصبح Part Number.
     */
    if (
      /^(NEW|USED|REFURBISHED|OPEN BOX|LOT|PCS?|PART NUMBER)$/i.test(
        normalized
      )
    ) {
      return false;
    }

    /*
     * يمنع قيمًا مثل:
     * MODEL 550
     * REV 02
     * NO 857822
     */
    if (
      /^(REV|REVISION|VER|VERSION|MODEL|TYPE|NO|NUMBER|ART|ARTICLE|CAT|CATALOG|REF|REFERENCE|ORDER|SERIAL|SN|LOT|QTY)[\s\-/.]+[A-Z0-9.]+$/i.test(
        normalized
      )
    ) {
      return false;
    }

    /*
     * يمنع أوصافًا مثل:
     * 8 CHANNEL
     * 16 PORTS
     */
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

    /*
     * يمنع الفولتية والتردد والقدرة.
     */
    if (
      /^\d+(?:\.\d+)?\s*(VAC|VDC|AC|DC|V|HZ|KHZ|MHZ|KW|W|AMP|AMPS|A|MA)$/i.test(
        normalized
      )
    ) {
      return false;
    }

    /*
     * رقم القطعة يجب أن يحتوي على رقم واحد على الأقل.
     */
    if (!/\d/.test(normalized)) {
      return false;
    }

    /*
     * يمنع الجمل الطويلة من أن تصبح رقم قطعة.
     */
    if (normalized.length > 80) {
      return false;
    }

    if (normalized.split(/\s+/).length > 5) {
      return false;
    }

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
          normalizeText(aspect?.name).toLowerCase() ===
          name.toLowerCase()
      );

      const value = cleanCandidate(found?.value);

      if (isValidPartNumber(value)) {
        return value;
      }
    }

    return '';
  }

  /*
   * الأولوية لرقم القطعة المكتوب في بيانات eBay.
   */
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

  /*
   * إذا لم نجد MPN صالحًا، نحاول الاستخراج من العنوان.
   */
  const extracted = cleanCandidate(
    extractPartNumber(title)
  );

  if (isValidPartNumber(extracted)) {
    return extracted;
  }

  return 'UNKNOWN';
}

function getBrand(item: any, title: string): string {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const aspectBrand =
    aspects.find(
      (aspect: any) =>
        normalizeText(aspect?.name).toLowerCase() === 'brand'
    )?.value || '';

  const ebayBrand = normalizeText(
    item?.brand || aspectBrand
  );

  if (!isUnknownValue(ebayBrand)) {
    return ebayBrand;
  }

  return detectIndustrialBrand(title) || 'UNKNOWN';
}

function getGalleryUrls(item: any): string[] {
  const urls = [
    item?.image?.imageUrl,

    ...(Array.isArray(item?.additionalImages)
      ? item.additionalImages.map(
          (image: any) => image?.imageUrl
        )
      : []),

    ...(Array.isArray(item?.thumbnailImages)
      ? item.thumbnailImages.map(
          (image: any) => image?.imageUrl
        )
      : []),
  ];

  return normalizeUrlArray(urls);
}

function getSeller(
  item: any,
  existing?: ExistingProduct
): string {
  return (
    normalizeText(item?.seller?.username) ||
    normalizeText(item?.seller?.userId) ||
    normalizeText(existing?.seller) ||
    'orbitcontrol'
  );
}

function getDescription(item: any, title: string): string {
  return (
    normalizeText(item?.shortDescription) ||
    normalizeText(item?.description) ||
    title
  );
}

function getSafePartNumber(
  incomingPartNumber: string,
  existing?: ExistingProduct
): string {
  /*
   * لا نمسح Part Number صحيحًا ونستبدله بـ UNKNOWN.
   */
  if (
    incomingPartNumber &&
    incomingPartNumber !== 'UNKNOWN'
  ) {
    return incomingPartNumber;
  }

  const existingPartNumber = normalizeText(
    existing?.part_number
  );

  if (
    existingPartNumber &&
    existingPartNumber.toUpperCase() !== 'UNKNOWN'
  ) {
    return existingPartNumber;
  }

  return 'UNKNOWN';
}

function getSafeBrand(
  incomingBrand: string,
  existing?: ExistingProduct
): string {
  /*
   * لا نستبدل براند صحيحًا بـ UNKNOWN.
   */
  if (!isUnknownValue(incomingBrand)) {
    return incomingBrand;
  }

  const existingBrand = normalizeText(existing?.brand);

  if (!isUnknownValue(existingBrand)) {
    return existingBrand;
  }

  return 'UNKNOWN';
}

function getSafeCategory(
  incomingCategory: string,
  existing?: ExistingProduct
): string {
  const incoming = normalizeText(incomingCategory);
  const existingCategory = normalizeText(existing?.category);

  const incomingIsGeneric =
    !incoming ||
    incoming === 'Industrial Automation' ||
    incoming.toUpperCase() === 'UNCATEGORIZED';

  const existingIsUseful =
    existingCategory &&
    existingCategory !== 'Industrial Automation' &&
    existingCategory.toUpperCase() !== 'UNCATEGORIZED';

  /*
   * لا نستبدل تصنيفًا صحيحًا بتصنيف عام.
   */
  if (incomingIsGeneric && existingIsUseful) {
    return existingCategory;
  }

  return incoming || existingCategory || 'Industrial Automation';
}

async function createFeedTask(
  accessToken: string
): Promise<string> {
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
    const responseText = await response
      .text()
      .catch(() => '');

    throw new Error(
      `Failed to create feed task: ${response.status} ${responseText}`
    );
  }

  return taskId;
}

async function getTaskStatus(
  accessToken: string,
  taskId: string
): Promise<string> {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Failed to check feed task: ${response.status}`
    );
  }

  return data?.status || data?.taskStatus || 'UNKNOWN';
}

async function downloadFeedRows(
  accessToken: string,
  taskId: string
): Promise<FeedRow[]> {
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
    throw new Error(
      `Failed to download feed: ${response.status}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  const zip = await JSZip.loadAsync(buffer);

  const fileName = Object.keys(zip.files).find(
    (name) => !zip.files[name].dir
  );

  if (!fileName) {
    throw new Error('The downloaded eBay feed is empty.');
  }

  const xml = await zip.files[fileName].async('string');

  const blocks =
    xml.match(
      /<SKUDetails>[\s\S]*?<\/SKUDetails>/g
    ) || [];

  return blocks
    .map((block): FeedRow | null => {
      const ebayItemId = getTag(block, 'ItemID');

      if (!ebayItemId) {
        return null;
      }

      return {
        ebay_item_id: ebayItemId,
        sku: getTag(block, 'SKU'),
        quantity: Number(
          getTag(block, 'Quantity') || 0
        ),
      };
    })
    .filter(
      (row): row is FeedRow => row !== null
    )
    /*
     * نزامن المنتجات النشطة فقط.
     * اختفاء المنتج من هذه القائمة لا يحذفه من الموقع.
     */
    .filter((row) => row.quantity > 0);
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<any | null> {
  const response = await fetch(
  `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(
    ebayItemId
  )}`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept-Language': 'en-US',
    },
  }
);

if (!response.ok) {
  const text = await response.text();

  console.error(
    `Browse API Error for ${ebayItemId}:`,
    response.status,
    text
  );

  if (response.status === 429) {
    await new Promise((resolve) =>
      setTimeout(resolve, 5000)
    );
  }

  return null;
}
return response.json();
}

async function loadExistingProducts(
  rows: FeedRow[]
): Promise<Map<string, ExistingProduct>> {
  const products = new Map<string, ExistingProduct>();

  for (
    let index = 0;
    index < rows.length;
    index += 500
  ) {
    const chunk = rows.slice(index, index + 500);

    const itemIds = chunk.map((row) =>
      String(row.ebay_item_id)
    );

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        sku,
        part_number,
        model_number,
        brand,
        category,
        name,
        condition,
        description,
        image_url,
        ebay_image_url,
        ebay_gallery_urls,
        r2_image_url,
        r2_gallery_urls,
        image_status,
        image_count,
        seller,
        source,
        source_type,
        marketplace,
        slug
      `)
      .in('ebay_item_id', itemIds);

    if (error) {
      throw error;
    }

    for (const product of data || []) {
      const itemId = normalizeText(
        product.ebay_item_id
      );

      if (itemId) {
        products.set(
          itemId,
          product as ExistingProduct
        );
      }
    }
  }

  return products;
}

async function ensureJob(): Promise<any> {
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
        inserted: 0,
        updated: 0,
        failed: 0,
      })
      .select('*')
      .single();

  if (createError) {
    throw createError;
  }

  return created;
}

async function updateJobError(
  message: string
): Promise<void> {
  await supabaseAdmin
    .from('sync_jobs')
    .update({
      status: 'error',
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', JOB_ID);
}

export async function GET(req: NextRequest) {
  try {
    const requestedLimit = Number(
      req.nextUrl.searchParams.get('limit') ||
        DEFAULT_LIMIT
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    );

    const now = new Date().toISOString();

    const { access_token } = await getEbayToken();
    const accessToken = normalizeText(access_token);

    if (!accessToken) {
      throw new Error(
        'Unable to retrieve an eBay access token.'
      );
    }

    const job = await ensureJob();

    let taskId = normalizeText(
      job.feed_task_id
    ) || null;

    /*
     * عند عدم وجود Feed Task، ننشئ واحدة جديدة.
     */
    if (
      !taskId ||
      job.stage === 'idle' ||
      job.stage === 'done'
    ) {
      taskId = await createFeedTask(accessToken);

      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'running',
          stage: 'waiting_feed',
          feed_task_id: taskId,
          offset_value: 0,
          batch_size: limit,
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
        message:
          'Feed task created. The next cron run will check its status.',
      });
    }

    const taskStatus = await getTaskStatus(
      accessToken,
      taskId
    );

    if (taskStatus !== 'COMPLETED') {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'running',
          stage: 'waiting_feed',
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'waiting_feed',
        taskId,
        ebayStatus: taskStatus,
      });
    }

    const feedRows = await downloadFeedRows(
      accessToken,
      taskId
    );

    /*
     * offset_value يسمح لنا بمزامنة Feed كاملة على دفعات،
     * بدل معالجة المنتجات الجديدة فقط.
     */
    const currentOffset = Math.max(
      0,
      Number(job.offset_value || 0)
    );

    const batchRows = feedRows.slice(
      currentOffset,
      currentOffset + limit
    );

    /*
     * انتهت كل الدفعات.
     */
    if (!batchRows.length) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'idle',
          stage: 'done',
          offset_value: 0,
          feed_task_id: null,
          finished_at: now,
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'sync_completed',
        totalActiveFeedItems: feedRows.length,
        inserted: 0,
        updated: 0,
        skippedManual: 0,
        failed: 0,
        message:
          'eBay synchronization completed. No products were deleted or hidden.',
      });
    }

    const existingProducts =
      await loadExistingProducts(batchRows);
const newRows = batchRows.filter((row) => {
  const itemId = normalizeText(row.ebay_item_id);
  return itemId && !existingProducts.has(itemId);
});
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedManual = 0;
    let failed = 0;

    let unknownBrand = 0;
    let unknownPartNumber = 0;
    let missingImage = 0;
    let uncategorized = 0;

    const sample: any[] = [];

    for (
  let index = 0;
  index < newRows.length;
  index += CONCURRENCY
) {
  const chunk = newRows.slice(
    index,
    index + CONCURRENCY
  );

      const details = await Promise.all(
        chunk.map((row) =>
          fetchEbayItem(
            accessToken,
            row.ebay_item_id
          )
        )
      );

      for (
        let itemIndex = 0;
        itemIndex < chunk.length;
        itemIndex++
      ) {
        const row = chunk[itemIndex];
        const item = details[itemIndex];

        try {
          if (!item?.title) {
            failed++;

            sample.push({
              ebayItemId: row.ebay_item_id,
              action: 'failed',
              error:
                'The Browse API did not return product details.',
            });

            continue;
          }

          const realItemId =
            getRealItemId(item.itemId) ||
            row.ebay_item_id;

          const existing =
            existingProducts.get(realItemId) ||
            existingProducts.get(
              row.ebay_item_id
            );

          /*
           * أي منتج يدوي لا يلمسه المستورد.
           */
          if (isManualProduct(existing)) {
            skippedManual++;

            sample.push({
              ebayItemId: realItemId,
              action: 'skipped_manual',
            });

            continue;
          }

          const title = normalizeText(item.title);

          const incomingPartNumber =
            getBestPartNumber(
              item,
              title,
              realItemId
            );

          const incomingBrand = getBrand(
            item,
            title
          );

          const partNumber = getSafePartNumber(
            incomingPartNumber,
            existing
          );

          const brand = getSafeBrand(
            incomingBrand,
            existing
          );

          const detectedCategory =
            detectCategory(
              title,
              brand,
              partNumber
            );

          const ebayCategory = normalizeText(
            item.categoryPath
          );

          const incomingCategory =
            detectedCategory &&
            detectedCategory !==
              'Industrial Automation'
              ? detectedCategory
              : ebayCategory ||
                'Industrial Automation';

          const category = getSafeCategory(
            incomingCategory,
            existing
          );

          const cleanedName =
            cleanProductName({
              title,
              brand,
              partNumber,
            }) || title;

          const condition = cleanCondition(
            item.condition || 'Used'
          );

          const galleryUrls =
            getGalleryUrls(item);

          const ebayImageUrl =
            galleryUrls[0] || null;

          const description = getDescription(
            item,
            title
          );

          const seller = getSeller(
            item,
            existing
          );

          if (
            !brand ||
            brand.toUpperCase() === 'UNKNOWN'
          ) {
            unknownBrand++;
          }

          if (
            !partNumber ||
            partNumber === 'UNKNOWN'
          ) {
            unknownPartNumber++;
          }

          if (!ebayImageUrl) {
            missingImage++;
          }

          if (
            !category ||
            category ===
              'Industrial Automation' ||
            category.toUpperCase() ===
              'UNCATEGORIZED'
          ) {
            uncategorized++;
          }

          /*
           * منتج موجود: تحديث الحقول المسموح بها فقط.
           *
           * ممنوع:
           * - حذف المنتج.
           * - تعطيل المنتج.
           * - إخفاء المنتج.
           * - تصفير روابط R2.
           */
          if (existing) {
            const imagesChanged =
              existing.ebay_image_url !==
                ebayImageUrl ||
              !sameStringArray(
                existing.ebay_gallery_urls,
                galleryUrls
              );

            const updatePayload: Record<
              string,
              unknown
            > = {
              name: cleanedName,
              part_number: partNumber,
              model_number: partNumber,
              brand,
              category,
              condition,
              description,
              seller,
              marketplace: 'EBAY_US',
              last_seen_at: now,
              updated_at: now,
            };

            /*
             * عند تغير صور eBay:
             * - نحدث روابط eBay.
             * - لا نمسح روابط R2 الحالية.
             * - نضع pending لتعمل مزامنة الصور الموجودة.
             *
             * image_url يبقى كما هو للمنتج الموجود،
             * حتى لا نستبدل صورة R2 بصورة eBay مؤقتًا.
             */
            if (imagesChanged) {
              updatePayload.ebay_image_url =
                ebayImageUrl;

              updatePayload.ebay_gallery_urls =
                galleryUrls;

              updatePayload.image_count =
                galleryUrls.length;

              updatePayload.image_status =
                ebayImageUrl
                  ? 'pending'
                  : 'missing';

              updatePayload.images_sync_error =
                null;
            }

            const { error: updateError } =
              await supabaseAdmin
                .from('products')
                .update(updatePayload)
                .eq('id', existing.id);

            if (updateError) {
              throw updateError;
            }

            updated++;

            sample.push({
              ebayItemId: realItemId,
              action: 'updated',
              brand,
              partNumber,
              condition,
              imagesChanged,
            });

            continue;
          }

          /*
           * منتج جديد: إدخاله في قاعدة البيانات.
           */
          const product = {
            ebay_item_id: realItemId,

            /*
             * SKU يبقى رقم eBay داخليًا فقط،
             * ولا يستخدم أبدًا كـ Part Number.
             */
            sku:
              normalizeText(row.sku) ||
              realItemId,

            part_number: partNumber,
            model_number: partNumber,

            brand,
            category,
            name: cleanedName,
            condition,

            /*
             * المنتج الجديد يستخدم صورة eBay مؤقتًا
             * حتى تكتمل عملية النسخ إلى R2.
             */
            image_url: ebayImageUrl,
            ebay_image_url: ebayImageUrl,
            ebay_gallery_urls: galleryUrls,

            r2_image_url: null,
            r2_gallery_urls: [],

            image_status: ebayImageUrl
              ? 'pending'
              : 'missing',

            image_count: galleryUrls.length,
            images_sync_error: null,

            description,

            slug: slugify(
              `${realItemId}-${
                partNumber !== 'UNKNOWN'
                  ? partNumber
                  : cleanedName
              }`
            ),

            marketplace: 'EBAY_US',
            seller,
            source: 'ebay-auto-import',
            source_type: 'ebay',

            is_active: true,
            is_catalog_visible: true,
            catalog_visible: true,

            last_seen_at: now,
            updated_at: now,
          };

          const { error: insertError } =
            await supabaseAdmin
              .from('products')
              .insert(product);

          if (insertError) {
            throw insertError;
          }

          inserted++;

          sample.push({
            ebayItemId: realItemId,
            action: 'inserted',
            brand,
            partNumber,
            condition,
          });
        } catch (error) {
          failed++;

          sample.push({
            ebayItemId: row.ebay_item_id,
            action: 'failed',
            error: getErrorMessage(error),
          });
        }
      }
    }

    const nextOffset =
      currentOffset + batchRows.length;

    const completed =
      nextOffset >= feedRows.length;

    /*
     * عند نهاية Feed:
     * - لا نحذف المنتجات غير الموجودة.
     * - لا نخفيها.
     * - نعيد offset إلى صفر للدورة القادمة.
     */
    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: completed
          ? 'idle'
          : 'running',

        stage: completed
          ? 'done'
          : 'syncing',

        offset_value: completed
          ? 0
          : nextOffset,

        feed_task_id: completed
          ? null
          : taskId,

        batch_size: limit,

        processed:
          Number(job.processed || 0) +
          batchRows.length,

        inserted:
          Number(job.inserted || 0) +
          inserted,

        updated:
          Number(job.updated || 0) +
          updated,

        failed:
          Number(job.failed || 0) +
          failed,

        finished_at: completed
          ? now
          : null,

        last_error: null,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,

      stage: completed
        ? 'sync_completed'
        : 'sync_batch',

      taskId,

      totalActiveFeedItems:
        feedRows.length,

      currentOffset,

      nextOffset: completed
        ? 0
        : nextOffset,

      completed,

      checkedProducts:
        batchRows.length,

      inserted,
      updated,
      unchanged,
      skippedManual,
      failed,

      deletionPolicy:
        'Products are never deleted, disabled, or hidden.',

      manualProductPolicy:
        'Manual products are never modified.',

      r2Policy:
        'Existing R2 image URLs are never cleared.',

      quality: {
        unknown_brand: unknownBrand,
        unknown_part_number:
          unknownPartNumber,
        missing_image: missingImage,
        uncategorized,
      },

      sample: sample.slice(0, 10),
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await updateJobError(message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
