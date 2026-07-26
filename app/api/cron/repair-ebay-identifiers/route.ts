import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = 'repair-ebay-identifiers';
const MARKETPLACE = 'EBAY_US';
const SCAN_BATCH_SIZE = 300;
const MAX_API_ITEMS_PER_RUN = 5;
const CONCURRENCY = 2;
const DELAY_BETWEEN_CHUNKS_MS = 500;
const MAX_RETRIES = 3;

const INVALID_VALUES =
  /^(DOES NOT APPLY|NOT APPLICABLE|N\/A|NA|NONE|UNKNOWN|UNBRANDED|GENERIC)$/i;

type ProductRow = {
  id: number;
  ebay_item_id: string | null;
  brand: string | null;
  part_number: string | null;
  name: string | null;
  marketplace: string | null;
};

type FetchResult =
  | { ok: true; item: any }
  | { ok: false; rateLimited: true; status: 429; error: string }
  | { ok: false; rateLimited: false; status: number; error: string };

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeForCompare(value: unknown): string {
  return normalize(value).toUpperCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAspectValue(item: any, names: string[]): string {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const accepted = new Set(
    names.map((name) => name.trim().toLowerCase())
  );

  const found = aspects.find((aspect: any) =>
    accepted.has(String(aspect?.name ?? '').trim().toLowerCase())
  );

  return normalize(found?.value);
}

function isValidBrand(value: unknown): boolean {
  const brand = normalize(value);
  if (!brand || brand.length > 100) return false;
  return !INVALID_VALUES.test(brand);
}

function isValidPartNumber(
  value: unknown,
  ebayItemId: unknown
): boolean {
  const partNumber = normalize(value);
  const compared = normalizeForCompare(value);
  const itemId = normalizeForCompare(ebayItemId);

  if (!partNumber || partNumber.length > 80) return false;
  if (INVALID_VALUES.test(partNumber)) return false;
  if (compared === itemId) return false;
  if (/^\d{12}$/.test(compared)) return false;

  return true;
}

function needsRepair(product: ProductRow): boolean {
  return (
    !isValidBrand(product.brand) ||
    !isValidPartNumber(product.part_number, product.ebay_item_id)
  );
}

function getEbayIdentifiers(item: any, ebayItemId: string) {
  const rawBrand =
    getAspectValue(item, ['brand']) || normalize(item?.brand);

  const rawMpn = getAspectValue(item, [
    'mpn',
    'manufacturer part number',
  ]);

  const rawModel = getAspectValue(item, [
    'model',
    'model number',
  ]);

  const ebayBrand = isValidBrand(rawBrand) ? rawBrand : '';
  const ebayMpn = isValidPartNumber(rawMpn, ebayItemId) ? rawMpn : '';
  const ebayModel = isValidPartNumber(rawModel, ebayItemId)
    ? rawModel
    : '';

  return {
    ebayBrand,
    ebayMpn,
    ebayModel,
    partNumber: ebayMpn || ebayModel || '',
  };
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string,
  attempt = 1
): Promise<FetchResult> {
  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(ebayItemId)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    });
  } catch (error) {
    return {
      ok: false,
      rateLimited: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (response.ok) {
    const item = await response.json().catch(() => null);
    return item
      ? { ok: true, item }
      : {
          ok: false,
          rateLimited: false,
          status: response.status,
          error: 'Empty eBay response.',
        };
  }

  const text = await response.text().catch(() => '');

  if (response.status === 429) {
    if (attempt < MAX_RETRIES) {
      const retryAfter = Number(
        response.headers.get('retry-after') || 0
      );
      const waitMs =
        retryAfter > 0
          ? retryAfter * 1000
          : attempt === 1
            ? 5000
            : 15000;

      await sleep(waitMs);
      return fetchEbayItem(accessToken, ebayItemId, attempt + 1);
    }

    return {
      ok: false,
      rateLimited: true,
      status: 429,
      error: `eBay rate limit after ${MAX_RETRIES} attempts. ${text.slice(0, 200)}`,
    };
  }

  if (response.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(attempt * 3000);
    return fetchEbayItem(accessToken, ebayItemId, attempt + 1);
  }

  return {
    ok: false,
    rateLimited: false,
    status: response.status,
    error: `eBay HTTP ${response.status}: ${text.slice(0, 200)}`,
  };
}

async function getJob() {
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
      stage: 'ready_us_only',
      offset_value: 0,
      batch_size: SCAN_BATCH_SIZE,
      processed: 0,
      updated: 0,
      failed: 0,
      updated_at: now,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';

  return Boolean(cronSecret) &&
    authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let unresolved = 0;
  let failed = 0;
  let rateLimited = false;
  const results: any[] = [];

  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();
    const job = await getJob();

    if (job.status === 'paused') {
      return NextResponse.json({
        success: true,
        paused: true,
        message: 'Job is paused. No eBay requests were sent.',
      });
    }

    const lastScannedId = Number(job.offset_value || 0);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'running',
        stage: 'scanning_us_unresolved',
        last_error: null,
        updated_at: now,
        finished_at: null,
      })
      .eq('id', JOB_ID);

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,ebay_item_id,brand,part_number,name,marketplace')
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .gt('id', lastScannedId)
      .order('id', { ascending: true })
      .limit(SCAN_BATCH_SIZE);

    if (error) throw error;

    const rows = (data || []) as ProductRow[];

    if (rows.length === 0) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'completed',
          stage: 'completed_us_only',
          offset_value: lastScannedId,
          updated_at: now,
          finished_at: now,
          last_error: null,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        completed: true,
        marketplace: MARKETPLACE,
        message: 'US-only repair completed.',
      });
    }

    const candidates = rows
      .filter(needsRepair)
      .slice(0, MAX_API_ITEMS_PER_RUN);

    if (candidates.length === 0) {
      const lastRowId = rows[rows.length - 1].id;

      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'idle',
          stage: 'scan_window_clean',
          offset_value: lastRowId,
          updated_at: now,
          finished_at: now,
          last_error: null,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        marketplace: MARKETPLACE,
        scanned: rows.length,
        candidates: 0,
        nextId: lastRowId,
      });
    }

    const { access_token } = await getEbayToken();
    const accessToken = normalize(access_token);

    if (!accessToken) {
      throw new Error('Could not obtain eBay token.');
    }

    let safeCursorId = lastScannedId;

    for (
      let index = 0;
      index < candidates.length;
      index += CONCURRENCY
    ) {
      const chunk = candidates.slice(index, index + CONCURRENCY);

      const fetchResults = await Promise.all(
        chunk.map((product) =>
          fetchEbayItem(
            accessToken,
            normalize(product.ebay_item_id)
          )
        )
      );

      const chunkHitRateLimit = fetchResults.some(
        (result) => !result.ok && result.rateLimited
      );

      for (let i = 0; i < chunk.length; i++) {
        const product = chunk[i];
        const fetchResult = fetchResults[i];
        const ebayItemId = normalize(product.ebay_item_id);

        if (!fetchResult.ok) {
          if (fetchResult.rateLimited) {
            rateLimited = true;
            results.push({
              id: product.id,
              ebayItemId,
              status: 'rate_limited_not_failed',
            });
            continue;
          }

          processed++;
          failed++;
          results.push({
            id: product.id,
            ebayItemId,
            status: 'ebay_fetch_failed',
            httpStatus: fetchResult.status,
            error: fetchResult.error,
          });
          continue;
        }

        processed++;

        const identifiers = getEbayIdentifiers(
          fetchResult.item,
          ebayItemId
        );

        const oldBrand = normalize(product.brand);
        const oldPartNumber = normalize(product.part_number);

        const brandNeedsRepair = !isValidBrand(oldBrand);
        const partNeedsRepair = !isValidPartNumber(
          oldPartNumber,
          ebayItemId
        );

        const updatePayload: {
          brand?: string;
          part_number?: string;
          updated_at?: string;
        } = {};

        if (brandNeedsRepair && identifiers.ebayBrand) {
          updatePayload.brand = identifiers.ebayBrand;
        }

        if (partNeedsRepair && identifiers.partNumber) {
          updatePayload.part_number = identifiers.partNumber;
        }

        if (
          !updatePayload.brand &&
          !updatePayload.part_number
        ) {
          if (
            (!brandNeedsRepair || identifiers.ebayBrand) &&
            (!partNeedsRepair || identifiers.partNumber)
          ) {
            unchanged++;
          } else {
            unresolved++;
          }

          results.push({
            id: product.id,
            ebayItemId,
            status: 'still_unresolved',
            brandNeeded: brandNeedsRepair,
            partNumberNeeded: partNeedsRepair,
          });
          continue;
        }

        updatePayload.updated_at = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update(updatePayload)
          .eq('id', product.id)
          .eq('marketplace', MARKETPLACE);

        if (updateError) {
          failed++;
          results.push({
            id: product.id,
            ebayItemId,
            status: 'database_update_failed',
            error: updateError.message,
          });
          continue;
        }

        updated++;
        results.push({
          id: product.id,
          ebayItemId,
          status: 'updated',
          fields: Object.keys(updatePayload).filter(
            (key) => key !== 'updated_at'
          ),
        });
      }

      if (chunkHitRateLimit) break;

      safeCursorId = chunk[chunk.length - 1].id;

      if (index + CONCURRENCY < candidates.length) {
        await sleep(DELAY_BETWEEN_CHUNKS_MS);
      }
    }

    const canAdvanceToEnd =
      !rateLimited &&
      candidates.length < MAX_API_ITEMS_PER_RUN;

    const nextCursorId = canAdvanceToEnd
      ? rows[rows.length - 1].id
      : safeCursorId;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'idle',
        stage: rateLimited
          ? 'rate_limited_waiting_next_cron'
          : 'batch_completed_us_only',
        offset_value: nextCursorId,
        batch_size: SCAN_BATCH_SIZE,
        processed: Number(job.processed || 0) + processed,
        updated: Number(job.updated || 0) + updated,
        failed: Number(job.failed || 0) + failed,
        last_error: rateLimited
          ? 'eBay HTTP 429. Stopped safely; not counted as failure.'
          : null,
        updated_at: now,
        finished_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      marketplace: MARKETPLACE,
      scanned: rows.length,
      candidates: candidates.length,
      previousCursorId: lastScannedId,
      nextCursorId,
      processed,
      updated,
      unchanged,
      unresolved,
      failed,
      rateLimited,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

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
        processed,
        updated,
        unchanged,
        unresolved,
        failed,
        rateLimited,
        error: message,
      },
      { status: 500 }
    );
  }
}
