import { NextRequest, NextResponse } from 'next/server';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const REQUEST_DELAY_MS = 900;

const ROUTE_VERSION = 'RESTORE-EBAY-DATA-V1-SAFE-2';

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  name: string | null;
  description: string | null;
  brand: string | null;
  condition: string | null;
  source: string | null;
  source_type: string | null;
};

type EbayItemResponse = {
  item: Record<string, any> | null;
  status: number;
  error?: string;
  retryAfter?: string | null;
};

type RestoreResult = {
  id: string | number;
  ebayItemId: string;
  beforeName?: string;
  afterName?: string;
  beforeDescription?: string;
  afterDescription?: string;
  action:
    | 'updated'
    | 'unchanged'
    | 'dry_run'
    | 'skipped_manual'
    | 'missing_item_id'
    | 'missing_title'
    | 'not_found'
    | 'rate_limited'
    | 'failed';
  error?: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * eBay Item IDs may look like:
 *
 * 276643691235
 *
 * or:
 *
 * v1|276643691235|0
 */
function getLegacyItemId(value: unknown): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  if (normalized.includes('|')) {
    const parts = normalized.split('|');

    return normalizeText(parts[1] || parts[0]);
  }

  return normalized;
}

function isManualProduct(product: ProductRow): boolean {
  const source = normalizeText(product.source).toLowerCase();
  const sourceType = normalizeText(
    product.source_type
  ).toLowerCase();

  return (
    source === 'manual' ||
    sourceType === 'manual' ||
    source.includes('manual') ||
    sourceType.includes('manual')
  );
}

function containsCorruptedReplyText(
  value: unknown
): boolean {
  const text = normalizeText(value).toLowerCase();

  if (!text) {
    return false;
  }

  const corruptedPatterns = [
    "we'll reply as soon as possible",
    'we will reply as soon as possible',
    'reply as soon as possible',
    'they are not included in the item price',
  ];

  return corruptedPatterns.some((pattern) =>
    text.includes(pattern)
  );
}

function cleanOriginalEbayTitle(
  value: unknown
): string {
  return normalizeText(value)
    // Remove lot quantity only from the beginning.
    .replace(
      /^\s*LOTS?\s*(?:OF\s*)?\d+\s*(?:PCS?|PIECES?|UNITS?|ITEMS?)?\s*[-–—:,]?\s*/i,
      ''
    )
    .replace(
      /^\s*\d+\s*(?:PCS?|PIECES?|UNITS?|ITEMS?)\s*[-–—:,]?\s*/i,
      ''
    )
    .replace(
      /^\s*(?:QTY|QUANTITY)\s*[:#-]?\s*\d+\s*[-–—:,]?\s*/i,
      ''
    )
    .replace(
      /^\s*\d+\s*[X×]\s*/i,
      ''
    )

    // Remove common condition text.
    .replace(/\bNEW\s+WITHOUT\s+BOX\b/gi, '')
    .replace(/\bNEW\s+WITH\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OPEN\s+BOX\b/gi, '')
    .replace(/\bOPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OLD\s+STOCK\b/gi, '')
    .replace(/\bNEW\s+SEALED\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bTESTED\s+OK\b/gi, '')
    .replace(
      /\bTRIED\s*(?:&|AND)\s*TESTED\b/gi,
      ''
    )

    // Remove packaging and accessory noise.
    .replace(/\bWITHOUT\s+ANY\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+ACCESSORIES\b/gi, '')
    .replace(/\bNO\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+BOX\b/gi, '')
    .replace(/\bNO\s+BOX\b/gi, '')
    .replace(/\bNO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bDAMAGED\s+BOX\b/gi, '')
    .replace(/\bBROKEN\s+BOX\b/gi, '')

    // Remove shipping noise.
    .replace(/\bFREE\s+SHIPPING\b/gi, '')
    .replace(/\bFAST\s+SHIPPING\b/gi, '')
    .replace(/\bWORLDWIDE\s+SHIPPING\b/gi, '')

    // Final normalization.
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s*[-–—|,:;]+\s*$/g, '')
    .replace(/^\s*[-–—|,:;]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEbayBrand(
  item: Record<string, any>
): string {
  const directBrand = normalizeText(item.brand);

  if (directBrand) {
    return directBrand;
  }

  const aspects = Array.isArray(
    item.localizedAspects
  )
    ? item.localizedAspects
    : [];

  const brandAspect = aspects.find(
    (aspect: any) =>
      normalizeText(aspect?.name).toLowerCase() ===
      'brand'
  );

  return normalizeText(brandAspect?.value);
}

function buildSafeDescription({
  title,
  brand,
  condition,
}: {
  title: string;
  brand: string;
  condition: string;
}): string {
  const safeBrand = normalizeText(brand);
  const safeCondition = normalizeText(condition);

  const productName =
    safeBrand &&
    !title
      .toLowerCase()
      .includes(safeBrand.toLowerCase())
      ? `${safeBrand} ${title}`
      : title;

  const conditionSentence = safeCondition
    ? `Condition: ${safeCondition}.`
    : '';

  return [
    `${productName} industrial equipment available for quotation.`,
    conditionSentence,
    'Worldwide shipping and RFQ support are available.',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSafeDescription({
  item,
  title,
  product,
}: {
  item: Record<string, any>;
  title: string;
  product: ProductRow;
}): string {
  /**
   * We intentionally do not trust eBay shortDescription.
   *
   * In this catalog it may contain seller messages such as:
   * "We'll reply as soon as possible."
   */

  const ebayBrand =
    getEbayBrand(item) ||
    normalizeText(product.brand);

  const ebayCondition =
    normalizeText(item.condition) ||
    normalizeText(product.condition);

  return buildSafeDescription({
    title,
    brand: ebayBrand,
    condition: ebayCondition,
  });
}

async function delay(
  milliseconds: number
): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<EbayItemResponse> {
  const legacyItemId =
    getLegacyItemId(ebayItemId);

  if (!legacyItemId) {
    return {
      item: null,
      status: 400,
      error: 'Missing eBay Item ID.',
      retryAfter: null,
    };
  }

  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(
      legacyItemId
    )}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept-Language': 'en-US',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const retryAfter =
    response.headers.get('retry-after');

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => '');

    return {
      item: null,
      status: response.status,
      error:
        errorText ||
        `eBay request failed with status ${response.status}.`,
      retryAfter,
    };
  }

  const item = await response
    .json()
    .catch(() => null);

  if (!item) {
    return {
      item: null,
      status: response.status,
      error: 'eBay returned an empty response.',
      retryAfter,
    };
  }

  return {
    item,
    status: response.status,
    retryAfter,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const requestedOffset = Number(
      request.nextUrl.searchParams.get(
        'offset'
      ) || 0
    );

    const requestedLimit = Number(
      request.nextUrl.searchParams.get(
        'limit'
      ) || DEFAULT_LIMIT
    );

    const dryRun =
      request.nextUrl.searchParams.get(
        'dryRun'
      ) === '1';

    const offset = Math.max(
      0,
      Number.isFinite(requestedOffset)
        ? Math.floor(requestedOffset)
        : 0
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedLimit)
          ? Math.floor(requestedLimit)
          : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    );

    const tokenResponse =
      await getEbayToken();

    const accessToken = normalizeText(
      tokenResponse.access_token
    );

    if (!accessToken) {
      throw new Error(
        'Unable to retrieve an eBay access token.'
      );
    }

    /**
     * Only select products that contain the known
     * corrupted reply text in name or description.
     *
     * This route does not process the whole catalog.
     */
    const {
      data: products,
      error: productsError,
    } = await supabaseAdmin
      .from('products')
      .select(
        `
          id,
          ebay_item_id,
          name,
          description,
          brand,
          condition,
          source,
          source_type
        `
      )
      .not('ebay_item_id', 'is', null)
      .or(
        [
          "name.ilike.%We'll reply as soon as possible%",
          "description.ilike.%We'll reply as soon as possible%",
          'name.ilike.%reply as soon%',
          'description.ilike.%reply as soon%',
          'name.ilike.%not included in the item price%',
          'description.ilike.%not included in the item price%',
        ].join(',')
      )
      .order('id', {
        ascending: true,
      })
      .range(
        offset,
        offset + limit - 1
      );

    if (productsError) {
      throw productsError;
    }

    const rows =
      (products ?? []) as ProductRow[];

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedManual = 0;
    let missingItemId = 0;
    let missingTitle = 0;
    let notFound = 0;
    let rateLimited = 0;
    let failed = 0;

    const results: RestoreResult[] = [];

    for (const product of rows) {
      const ebayItemId =
        getLegacyItemId(
          product.ebay_item_id
        );

      try {
        if (isManualProduct(product)) {
          skippedManual++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              action: 'skipped_manual',
            });
          }

          continue;
        }

        if (!ebayItemId) {
          missingItemId++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId: '',
              action: 'missing_item_id',
            });
          }

          continue;
        }

        processed++;

        const response =
          await fetchEbayItem(
            accessToken,
            ebayItemId
          );

        if (response.status === 429) {
          rateLimited++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              action: 'rate_limited',
              error:
                response.error ||
                'eBay rate limit reached.',
            });
          }

          break;
        }

        if (
          response.status === 404 ||
          response.status === 410
        ) {
          notFound++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              action: 'not_found',
              error:
                response.error ||
                'The eBay listing was not found.',
            });
          }

          await delay(REQUEST_DELAY_MS);

          continue;
        }

        if (!response.item) {
          failed++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              action: 'failed',
              error:
                response.error ||
                'eBay did not return item data.',
            });
          }

          await delay(REQUEST_DELAY_MS);

          continue;
        }

        const originalEbayTitle =
          cleanOriginalEbayTitle(
            response.item.title
          );

        if (
          !originalEbayTitle ||
          containsCorruptedReplyText(
            originalEbayTitle
          )
        ) {
          missingTitle++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              action: 'missing_title',
              error:
                'eBay did not return a valid product title.',
            });
          }

          await delay(REQUEST_DELAY_MS);

          continue;
        }

        const currentName =
          normalizeText(product.name);

        const currentDescription =
          normalizeText(
            product.description
          );

        const repairedDescription =
          getSafeDescription({
            item: response.item,
            title: originalEbayTitle,
            product,
          });

        const nameNeedsRepair =
          containsCorruptedReplyText(
            currentName
          ) ||
          !currentName;

        const descriptionNeedsRepair =
          containsCorruptedReplyText(
            currentDescription
          ) ||
          !currentDescription;

        const nextName = nameNeedsRepair
          ? originalEbayTitle
          : currentName;

        const nextDescription =
          descriptionNeedsRepair
            ? repairedDescription
            : currentDescription;

        if (
          nextName === currentName &&
          nextDescription ===
            currentDescription
        ) {
          unchanged++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              beforeName: currentName,
              afterName: nextName,
              beforeDescription:
                currentDescription,
              afterDescription:
                nextDescription,
              action: 'unchanged',
            });
          }

          await delay(REQUEST_DELAY_MS);

          continue;
        }

        if (dryRun) {
          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              beforeName: currentName,
              afterName: nextName,
              beforeDescription:
                currentDescription,
              afterDescription:
                nextDescription,
              action: 'dry_run',
            });
          }

          await delay(REQUEST_DELAY_MS);

          continue;
        }

        const updatePayload: {
          name?: string;
          description?: string;
          updated_at: string;
        } = {
          updated_at:
            new Date().toISOString(),
        };

        if (nameNeedsRepair) {
          updatePayload.name = nextName;
        }

        if (descriptionNeedsRepair) {
          updatePayload.description =
            nextDescription;
        }

        const {
          error: updateError,
        } = await supabaseAdmin
          .from('products')
          .update(updatePayload)
          .eq('id', product.id);

        if (updateError) {
          throw updateError;
        }

        updated++;

        if (results.length < 50) {
          results.push({
            id: product.id,
            ebayItemId,
            beforeName: currentName,
            afterName: nextName,
            beforeDescription:
              currentDescription,
            afterDescription:
              nextDescription,
            action: 'updated',
          });
        }

        await delay(REQUEST_DELAY_MS);
      } catch (error) {
        failed++;

        const message =
          getErrorMessage(error);

        console.error(
          `RESTORE EBAY DATA FAILED FOR PRODUCT ${product.id}:`,
          error
        );

        if (results.length < 50) {
          results.push({
            id: product.id,
            ebayItemId,
            action: 'failed',
            error: message,
          });
        }

        await delay(REQUEST_DELAY_MS);
      }
    }

    const reachedEnd =
      rows.length < limit;

    /**
     * Because repaired products disappear from the
     * corrupted-products query, offset 0 is the safest
     * continuation after each successful batch.
     */
    const nextOffset = 0;

    const baseUrl =
      request.nextUrl.origin +
      request.nextUrl.pathname;

    const nextUrl =
      rows.length === 0
        ? null
        : `${baseUrl}?offset=0&limit=${limit}&dryRun=${
            dryRun ? '1' : '0'
          }`;

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      dryRun,
      message: dryRun
        ? 'Preview completed. No database records were changed.'
        : 'Corrupted eBay product names and descriptions were repaired safely.',

      safety: {
        touchesOnly: [
          'name when corrupted',
          'description when corrupted',
          'updated_at',
        ],
        neverTouches: [
          'part_number',
          'model_number',
          'brand',
          'category',
          'condition',
          'sku',
          'slug',
          'images',
          'ebay_item_id',
        ],
      },

      batch: {
        offset,
        limit,
        rowsLoaded: rows.length,
        reachedEnd,
        nextOffset,
        nextUrl,
      },

      summary: {
        processed,
        updated,
        unchanged,
        skippedManual,
        missingItemId,
        missingTitle,
        notFound,
        rateLimited,
        failed,
      },

      results,
    });
  } catch (error) {
    const message =
      getErrorMessage(error);

    console.error(
      'RESTORE EBAY DATA ROUTE FAILED:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
