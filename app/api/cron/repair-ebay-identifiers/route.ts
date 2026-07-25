import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = 'repair-ebay-identifiers';
const BATCH_SIZE = 20;
const CONCURRENCY = 5;

const INVALID_VALUES =
  /^(DOES NOT APPLY|NOT APPLICABLE|N\/A|NA|NONE|UNKNOWN)$/i;

function normalize(value: unknown) {
  return String(value || '').trim();
}

function normalizeForCompare(value: unknown) {
  return normalize(value).toUpperCase();
}

function getAspectValue(item: any, names: string[]) {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const acceptedNames = new Set(
    names.map((name) => name.trim().toLowerCase())
  );

  const found = aspects.find((aspect: any) =>
    acceptedNames.has(
      String(aspect?.name || '').trim().toLowerCase()
    )
  );

  return normalize(found?.value);
}

function isValidIdentifier(value: string, ebayItemId: string) {
  const normalized = normalize(value);
  const compared = normalizeForCompare(value);
  const comparedItemId = normalizeForCompare(ebayItemId);

  if (!normalized) return false;
  if (normalized.length > 80) return false;
  if (INVALID_VALUES.test(normalized)) return false;
  if (compared === comparedItemId) return false;
  if (/^27\d{10}$/.test(compared)) return false;

  return true;
}

function getEbayIdentifiers(item: any, ebayItemId: string) {
  const rawBrand =
    getAspectValue(item, ['brand']) ||
    normalize(item?.brand);

  const rawMpn = getAspectValue(item, [
    'mpn',
    'manufacturer part number',
  ]);

  const rawModel = getAspectValue(item, [
    'model',
    'model number',
  ]);

  const ebayBrand = rawBrand || 'Unbranded';

  const ebayMpn = isValidIdentifier(rawMpn, ebayItemId)
    ? rawMpn
    : '';

  const ebayModel = isValidIdentifier(rawModel, ebayItemId)
    ? rawModel
    : '';

  return {
    ebayBrand,
    ebayMpn,
    ebayModel,
    partNumber: ebayMpn || ebayModel || '',
  };
}

function sleep(milliseconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string,
  attempt = 1
): Promise<any | null> {
  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(ebayItemId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept-Language': 'en-US',
    },
    cache: 'no-store',
  });

  if (response.ok) {
    return response.json();
  }

  if (
    (response.status === 429 || response.status >= 500) &&
    attempt < 4
  ) {
    const retryAfter = Number(
      response.headers.get('retry-after') || 0
    );

    const waitTime =
      retryAfter > 0
        ? retryAfter * 1000
        : attempt * 2000;

    await sleep(waitTime);

    return fetchEbayItem(
      accessToken,
      ebayItemId,
      attempt + 1
    );
  }

  const responseText = await response
    .text()
    .catch(() => '');

  console.error(
    `eBay fetch failed ${ebayItemId}: ` +
      `${response.status} ${responseText.slice(0, 200)}`
  );

  return null;
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

  const { data: created, error: createError } =
    await supabaseAdmin
      .from('sync_jobs')
      .insert({
        id: JOB_ID,
        status: 'idle',
        stage: 'repairing_identifiers',
        offset_value: 0,
        batch_size: BATCH_SIZE,
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

async function resetJobCursor() {
  await supabaseAdmin
    .from('sync_jobs')
    .update({
      offset_value: 0,
      stage: 'cycle_completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', JOB_ID);
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || '';

  if (!cronSecret) return false;

  const authorization =
    request.headers.get('authorization') || '';

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();
    const job = await getJob();

    const lastProcessedId = Number(
      job.offset_value || 0
    );

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'running',
        stage: 'repairing_identifiers',
        last_error: null,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    let { data: products, error } =
      await supabaseAdmin
        .from('products')
        .select(
          'id,ebay_item_id,part_number,model_number,brand,name'
        )
        .not('ebay_item_id', 'is', null)
        .gt('id', lastProcessedId)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

    if (error) throw error;

    let restartedCycle = false;

    if (!products?.length && lastProcessedId > 0) {
      await resetJobCursor();
      restartedCycle = true;

      const restartResult = await supabaseAdmin
        .from('products')
        .select(
          'id,ebay_item_id,part_number,model_number,brand,name'
        )
        .not('ebay_item_id', 'is', null)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

      if (restartResult.error) {
        throw restartResult.error;
      }

      products = restartResult.data;
    }

    if (!products?.length) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'idle',
          stage: 'no_products',
          offset_value: 0,
          updated_at: now,
          finished_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        message: 'No eBay products found.',
        processed: 0,
        updated: 0,
        failed: 0,
      });
    }

    const { access_token } = await getEbayToken();
    const accessToken = String(
      access_token || ''
    ).trim();

    if (!accessToken) {
      throw new Error('Could not obtain eBay token.');
    }

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let failed = 0;

    const results: any[] = [];

    for (
      let index = 0;
      index < products.length;
      index += CONCURRENCY
    ) {
      const chunk = products.slice(
        index,
        index + CONCURRENCY
      );

      const details = await Promise.all(
        chunk.map((product) =>
          fetchEbayItem(
            accessToken,
            String(product.ebay_item_id || '')
          )
        )
      );

      for (
        let itemIndex = 0;
        itemIndex < chunk.length;
        itemIndex++
      ) {
        const product = chunk[itemIndex];
        const item = details[itemIndex];

        processed++;

        const ebayItemId = String(
          product.ebay_item_id || ''
        ).trim();

        if (!item) {
          failed++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'ebay_fetch_failed',
          });

          continue;
        }

        const {
          ebayBrand,
          ebayMpn,
          ebayModel,
          partNumber,
        } = getEbayIdentifiers(item, ebayItemId);

        if (!partNumber) {
          skipped++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'no_valid_mpn_or_model',
            ebayBrand,
            ebayMpn,
            ebayModel,
          });

          continue;
        }

        const oldBrand = normalize(product.brand);
        const oldPartNumber = normalize(
          product.part_number
        );
        const oldModelNumber = normalize(
          product.model_number
        );

        const brandChanged =
          normalizeForCompare(oldBrand) !==
          normalizeForCompare(ebayBrand);

        const partChanged =
          normalizeForCompare(oldPartNumber) !==
          normalizeForCompare(partNumber);

        const modelChanged =
          Boolean(ebayModel) &&
          normalizeForCompare(oldModelNumber) !==
            normalizeForCompare(ebayModel);

        if (
          !brandChanged &&
          !partChanged &&
          !modelChanged
        ) {
          unchanged++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'unchanged',
          });

          continue;
        }

        const updatePayload: {
          brand: string;
          part_number: string;
          model_number?: string;
          updated_at: string;
        } = {
          brand: ebayBrand,
          part_number: partNumber,
          updated_at: new Date().toISOString(),
        };

        if (ebayModel) {
          updatePayload.model_number = ebayModel;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update(updatePayload)
            .eq('id', product.id);

        if (updateError) {
          failed++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'update_failed',
            error: updateError.message,
          });

          continue;
        }

        updated++;

        results.push({
          id: product.id,
          ebayItemId,
          status: 'updated',
          oldBrand,
          newBrand: ebayBrand,
          oldPartNumber,
          newPartNumber: partNumber,
          oldModelNumber,
          newModelNumber:
            ebayModel || oldModelNumber,
          ebayMpn,
          ebayModel,
        });
      }
    }

    const lastId =
      products[products.length - 1]?.id ||
      lastProcessedId;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'idle',
        stage: restartedCycle
          ? 'restarted_cycle'
          : 'batch_completed',
        offset_value: lastId,
        batch_size: BATCH_SIZE,
        processed:
          Number(job.processed || 0) + processed,
        updated:
          Number(job.updated || 0) + updated,
        failed:
          Number(job.failed || 0) + failed,
        updated_at: now,
        finished_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      restartedCycle,
      previousLastId: lastProcessedId,
      newLastId: lastId,
      processed,
      updated,
      unchanged,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

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
