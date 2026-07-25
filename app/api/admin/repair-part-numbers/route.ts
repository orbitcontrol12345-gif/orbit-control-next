import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const CONCURRENCY = 5;

const INVALID_EBAY_VALUES =
  /^(DOES NOT APPLY|NOT APPLICABLE|N\/A|NA|NONE|UNKNOWN|UNBRANDED)$/i;

function normalize(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function isValidEbayValue(value: string, ebayItemId: string) {
  const normalized = normalize(value);
  const itemId = normalize(ebayItemId);

  if (!normalized) return false;
  if (normalized.length > 80) return false;
  if (INVALID_EBAY_VALUES.test(normalized)) return false;
  if (normalized === itemId) return false;
  if (/^27\d{10}$/.test(normalized)) return false;

  return true;
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

function getEbayIdentifiers(item: any, ebayItemId: string) {
  const rawMpn = getAspectValue(item, [
    'mpn',
    'manufacturer part number',
  ]);

  const rawModel = getAspectValue(item, [
    'model',
    'model number',
  ]);

  const ebayMpn = isValidEbayValue(rawMpn, ebayItemId)
    ? rawMpn
    : '';

  const ebayModel = isValidEbayValue(rawModel, ebayItemId)
    ? rawModel
    : '';

  return {
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
      retryAfter > 0 ? retryAfter * 1000 : attempt * 2000;

    await sleep(waitTime);

    return fetchEbayItem(
      accessToken,
      ebayItemId,
      attempt + 1
    );
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const providedKey =
      url.searchParams.get('key') ||
      request.headers.get('x-repair-key') ||
      '';

    const expectedKey = process.env.REPAIR_API_KEY || '';

    if (!expectedKey || providedKey !== expectedKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const requestedPage = Number(
      url.searchParams.get('page') || '1'
    );

    const requestedLimit = Number(
      url.searchParams.get('limit') || DEFAULT_LIMIT
    );

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const limit = Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? Math.floor(requestedLimit)
          : DEFAULT_LIMIT,
        1
      ),
      MAX_LIMIT
    );

    const dryRun =
      url.searchParams.get('dryRun') !== 'false';

    const confirmed =
      url.searchParams.get('confirm') === 'UPDATE';

    if (!dryRun && !confirmed) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Real updates require dryRun=false&confirm=UPDATE',
        },
        { status: 400 }
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(
        'id,ebay_item_id,part_number,model_number,name'
      )
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) {
      throw new Error('Could not obtain eBay token.');
    }

    const results: any[] = [];
    let changed = 0;
    let unchanged = 0;
    let skipped = 0;
    let failed = 0;

    for (
      let index = 0;
      index < (products || []).length;
      index += CONCURRENCY
    ) {
      const chunk = (products || []).slice(
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
            title: product.name,
          });

          continue;
        }

        const oldPartNumber = normalize(
          product.part_number
        );

        const oldModelNumber = normalize(
          product.model_number
        );

        const newModelNumber =
          ebayModel || oldModelNumber;

        const partChanged =
          oldPartNumber !== partNumber;

        const modelChanged =
          ebayModel &&
          oldModelNumber !== ebayModel;

        if (!partChanged && !modelChanged) {
          unchanged++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'unchanged',
            partNumber: oldPartNumber,
            modelNumber: oldModelNumber,
          });

          continue;
        }

        if (dryRun) {
          changed++;

          results.push({
            id: product.id,
            ebayItemId,
            status: 'preview',
            oldPartNumber,
            newPartNumber: partNumber,
            oldModelNumber,
            newModelNumber,
            ebayMpn,
            ebayModel,
            title: product.name,
          });

          continue;
        }

        const updatePayload: {
          part_number: string;
          model_number?: string;
          updated_at: string;
        } = {
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

        changed++;

        results.push({
          id: product.id,
          ebayItemId,
          status: 'updated',
          oldPartNumber,
          newPartNumber: partNumber,
          oldModelNumber,
          newModelNumber,
          ebayMpn,
          ebayModel,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      page,
      limit,
      from,
      to,
      processed: products?.length || 0,
      changed,
      unchanged,
      skipped,
      failed,
      nextPage:
        products?.length === limit ? page + 1 : null,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
