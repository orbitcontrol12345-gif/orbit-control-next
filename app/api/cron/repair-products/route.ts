import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';
import { cleanProductName } from '@/lib/product-name';
import { detectCategory } from '@/lib/category-detector';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = 'repair-existing-products';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  brand: string | null;
  part_number: string | null;
  model_number: string | null;
  name: string | null;
  category: string | null;
  slug: string | null;
  description: string | null;
};

type ProductUpdate = {
  brand: string;
  part_number: string;
  model_number: string;
  name: string;
  category: string;
  slug: string;
  updated_at: string;
};

type RepairError = {
  id: string | number;
  error: string;
};

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function slugify(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function parsePositiveInteger(
  value: string | null,
  fallback: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
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

function isEbayItemId(value: unknown, ebayItemId: unknown): boolean {
  const normalized = normalizeUpper(value);
  const normalizedEbayItemId = normalizeUpper(ebayItemId);

  if (!normalized) return false;
  if (normalizedEbayItemId && normalized === normalizedEbayItemId) return true;
  if (/^27\d{10}$/.test(normalized)) return true;
  if (/^\d{12,13}$/.test(normalized)) return true;

  return false;
}

function isValidPartNumber(
  value: unknown,
  ebayItemId: unknown
): boolean {
  const normalized = normalizeUpper(value);
  const compact = normalized.replace(/\s+/g, '-');

  if (isUnknownValue(normalized)) return false;
  if (isEbayItemId(normalized, ebayItemId)) return false;

  if (/^(NEW|USED|REFURBISHED|OPEN BOX|LOT|PCS?|PART NUMBER)$/i.test(normalized)) {
    return false;
  }

  if (
    /^(REV|REVISION|VER|VERSION|MODEL|TYPE|NO|NUMBER|ART|ARTICLE|CAT|CATALOG|REF|REFERENCE|ORDER|SERIAL|SN|LOT|QTY)[\s\-/.]+[A-Z0-9.]+$/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /^\d+[\s\-]*(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?|INPUTS?|OUTPUTS?)$/i.test(
      normalized
    ) ||
    /^(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?|INPUTS?|OUTPUTS?)[\s\-]*\d+$/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /^\d+(?:\.\d+)?\s*(VAC|VDC|AC|DC|V|HZ|KHZ|MHZ|KW|W|AMP|AMPS|A|MA)$/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /^(REV|REVISION|VER|VERSION|MODEL|TYPE|NO|NUMBER)-[A-Z0-9.]+$/i.test(
      compact
    )
  ) {
    return false;
  }

  if (!/\d/.test(normalized)) return false;
  if (normalized.length > 80) return false;
  if (normalized.split(/\s+/).length > 5) return false;

  return true;
}

function getRepairSource(product: ProductRow): string {
  const name = normalizeText(product.name);
  const description = normalizeText(product.description);

  /*
   * الاسم الحالي أولى من الوصف.
   * الوصف لا يُستخدم كمصدر لاسم المنتج إلا عند غياب الاسم تمامًا.
   */
  if (name.length >= 4) {
    return name;
  }

  if (
    description.length >= 4 &&
    !/reply\s+as\s+soon\s+as\s+possible/i.test(description)
  ) {
    return description;
  }

  return '';
}

function getPartNumber(product: ProductRow, sourceTitle: string): string {
  const ebayItemId = normalizeText(product.ebay_item_id);
  const currentPartNumber = normalizeUpper(product.part_number);

  // نحافظ أولًا على رقم القطعة الحالي إذا كان صالحًا.
  if (isValidPartNumber(currentPartNumber, ebayItemId)) {
    return currentPartNumber;
  }

  const currentModelNumber = normalizeUpper(product.model_number);

  if (isValidPartNumber(currentModelNumber, ebayItemId)) {
    return currentModelNumber;
  }

  const extracted = normalizeUpper(extractPartNumber(sourceTitle));

  if (isValidPartNumber(extracted, ebayItemId)) {
    return extracted;
  }

  return 'UNKNOWN';
}

function getBrand(product: ProductRow, sourceTitle: string): string {
  const currentBrand = normalizeText(product.brand);

  // لا نستبدل براند صحيح بتخمين جديد من العنوان.
  if (!isUnknownValue(currentBrand)) {
    return currentBrand;
  }

  const detectedBrand = normalizeText(detectIndustrialBrand(sourceTitle));

  return isUnknownValue(detectedBrand) ? 'UNKNOWN' : detectedBrand;
}

function getCategory(
  product: ProductRow,
  sourceTitle: string,
  brand: string,
  partNumber: string
): string {
  const detectedCategory = normalizeText(
    detectCategory(sourceTitle, brand, partNumber)
  );
  const currentCategory = normalizeText(product.category);

  if (
    detectedCategory &&
    detectedCategory.toUpperCase() !== 'UNCATEGORIZED' &&
    detectedCategory !== 'Industrial Automation'
  ) {
    return detectedCategory;
  }

  if (
    currentCategory &&
    currentCategory.toUpperCase() !== 'UNCATEGORIZED'
  ) {
    return currentCategory;
  }

  return 'Industrial Automation';
}

function getProductName(
  product: ProductRow,
  sourceTitle: string,
  brand: string,
  partNumber: string
): string {
  const cleanedName = normalizeText(
    cleanProductName({
      title: sourceTitle,
      brand,
      partNumber,
    })
  );

  if (cleanedName) return cleanedName;

  const currentName = normalizeText(product.name);
  if (currentName) return currentName;

  if (partNumber !== 'UNKNOWN') {
    return `${brand !== 'UNKNOWN' ? brand : ''} ${partNumber}`.trim();
  }

  return brand !== 'UNKNOWN' ? brand : 'Industrial Automation Product';
}

function buildProductUpdate(
  product: ProductRow,
  now: string
): ProductUpdate {
  const sourceTitle = getRepairSource(product);
  const partNumber = getPartNumber(product, sourceTitle);
  const brand = getBrand(product, sourceTitle);
  const name = getProductName(product, sourceTitle, brand, partNumber);
  const category = getCategory(
    product,
    sourceTitle,
    brand,
    partNumber
  );

  const slugBase = normalizeText(product.ebay_item_id) || String(product.id);
  const slug = slugify(`${slugBase}-${name}`);

  return {
    brand,
    part_number: partNumber,
    model_number: partNumber,
    name,
    category,
    slug,
    updated_at: now,
  };
}

function hasChanged(
  product: ProductRow,
  update: ProductUpdate
): boolean {
  return (
    normalizeText(product.brand) !== normalizeText(update.brand) ||
    normalizeText(product.part_number) !== normalizeText(update.part_number) ||
    normalizeText(product.model_number) !== normalizeText(update.model_number) ||
    normalizeText(product.name) !== normalizeText(update.name) ||
    normalizeText(product.category) !== normalizeText(update.category) ||
    normalizeText(product.slug) !== normalizeText(update.slug)
  );
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // في حال لم يتم تعريف CRON_SECRET، يبقى المسار قابلًا للاختبار اليدوي.
  if (!cronSecret) return true;

  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

async function ensureJob(limit: number) {
  const { data, error } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabaseAdmin
    .from('sync_jobs')
    .insert({
      id: JOB_ID,
      status: 'idle',
      stage: 'idle',
      offset_value: 0,
      batch_size: limit,
      processed: 0,
      updated: 0,
      failed: 0,
      last_error: null,
      started_at: null,
      finished_at: null,
      updated_at: now,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      message:
        'repair-products is disabled because it previously used product descriptions as product titles.',
    },
    {
      status: 410,
    }
  );

  const requestedLimit = parsePositiveInteger(
    req.nextUrl.searchParams.get('limit'),
    DEFAULT_LIMIT
  );
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const reset = req.nextUrl.searchParams.get('reset') === '1';
  const now = new Date().toISOString();

  let checked = 0;
  let updated = 0;
  let skipped = 0;
  const errorDetails: RepairError[] = [];

  try {
    const job = await ensureJob(limit);
    let offset = reset ? 0 : Number(job.offset_value || 0);

    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }

    if (reset) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'running',
          stage: 'repairing',
          offset_value: 0,
          batch_size: limit,
          processed: 0,
          updated: 0,
          failed: 0,
          last_error: null,
          started_at: now,
          finished_at: null,
          updated_at: now,
        })
        .eq('id', JOB_ID);
    }

    const {
      data: products,
      error: productsError,
      count,
    } = await supabaseAdmin
      .from('products')
      .select(
        'id, ebay_item_id, brand, part_number, model_number, name, category, slug, description',
        { count: 'exact' }
      )
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (productsError) throw productsError;

    const rows = (products || []) as ProductRow[];

    for (const product of rows) {
      checked++;

      try {
        const update = buildProductUpdate(product, now);

        if (!update.name || !update.slug) {
          skipped++;
          continue;
        }

        if (!hasChanged(product, update)) {
          skipped++;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update(update)
          .eq('id', product.id);

        if (updateError) throw updateError;
        updated++;
     } catch (caughtError: any) {
  errorDetails.push({
    id: product.id,
    error: caughtError && caughtError.message
      ? caughtError.message
      : String(caughtError),
  });
}
    }
  
    const total = count || 0;
    const nextOffset = offset + rows.length;
    const completed = rows.length === 0 || nextOffset >= total;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: completed ? 'idle' : 'running',
        stage: completed ? 'done' : 'repairing',
        offset_value: completed ? 0 : nextOffset,
        batch_size: limit,
        processed: Number(job.processed || 0) + checked,
        updated: Number(job.updated || 0) + updated,
        failed: Number(job.failed || 0) + errorDetails.length,
        last_error: errorDetails.length
          ? errorDetails[0]?.error || null
          : null,
        started_at: job.started_at || now,
        finished_at: completed ? now : null,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      {
        success: true,
        jobId: JOB_ID,
        limit,
        offset,
        total,
        nextOffset: completed ? 0 : nextOffset,
        completed,
        checked,
        updated,
        skipped,
        errors: errorDetails.length,
        errorDetails: errorDetails.slice(0, 20),
        message: completed
          ? 'Repair cycle completed. The next cron run will start a new cycle.'
          : 'Batch repaired successfully. The next cron run will continue automatically.',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
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
      {
        success: false,
        checked,
        updated,
        skipped,
        errors: errorDetails.length + 1,
        errorDetails: [
          ...errorDetails.slice(0, 19),
          { id: 'route', error: message },
        ],
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
