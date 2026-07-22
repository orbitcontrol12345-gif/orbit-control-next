import { NextRequest, NextResponse } from 'next/server';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DELAY_MS = 1000;

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  name: string | null;
  description: string | null;
  source: string | null;
  source_type: string | null;
};

type EbayResult = {
  item: Record<string, unknown> | null;
  status: number;
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

function isCorruptedText(value: unknown): boolean {
  const text = normalizeText(value).toLowerCase();

  if (!text) {
    return true;
  }

  return (
    text.includes('reply as soon as possible') ||
    text.includes('not included in the item price')
  );
}

function cleanEbayTitle(value: unknown): string {
  return normalizeText(value)
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
    .replace(/^\s*\d+\s*[X×]\s*/i, '')
    .replace(/\bNEW\s+WITHOUT\s+BOX\b/gi, '')
    .replace(/\bNEW\s+WITH\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OPEN\s+BOX\b/gi, '')
    .replace(/\bOPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OLD\s+STOCK\b/gi, '')
    .replace(/\bNEW\s+SEALED\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bTESTED\s+OK\b/gi, '')
    .replace(/\bTRIED\s*(?:&|AND)\s*TESTED\b/gi, '')
    .replace(/\bWITHOUT\s+ANY\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+ACCESSORIES\b/gi, '')
    .replace(/\bNO\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+BOX\b/gi, '')
    .replace(/\bNO\s+BOX\b/gi, '')
    .replace(/\bNO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bFREE\s+SHIPPING\b/gi, '')
    .replace(/\bFAST\s+SHIPPING\b/gi, '')
    .replace(/\bWORLDWIDE\s+SHIPPING\b/gi, '')
    .replace(/^\s*[-–—|,:;]+\s*/g, '')
    .replace(/\s*[-–—|,:;]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function repairDescription(
  originalDescription: string,
  fallbackTitle: string
): string {
  let text = normalizeText(originalDescription);

  // Remove the corrupted sentences only
  text = text
    .replace(/We'll reply as soon as possible\.?/gi, '')
    .replace(/They are not included in the item price\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If description became empty, use the title
  if (!text) {
    text = fallbackTitle;
  }

  // Ensure it ends with a period
  text = text.replace(/\.*$/, '.');

  return (
    text +
    ' Industrial equipment available for quotation and worldwide shipping.'
  );
}
function buildDescription(title: string): string {
  return `${title}. Industrial equipment available for quotation and worldwide shipping.`;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<EbayResult> {
  const legacyItemId = getLegacyItemId(ebayItemId);

  if (!legacyItemId) {
    return {
      item: null,
      status: 400,
      error: 'Missing eBay item ID.',
    };
  }

  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(legacyItemId)}`;

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

  if (!response.ok) {
    const responseText = await response
      .text()
      .catch(() => '');

    return {
      item: null,
      status: response.status,
      error:
        responseText ||
        `eBay returned status ${response.status}.`,
    };
  }

  const item = await response
    .json()
    .catch(() => null);

  if (!item) {
    return {
      item: null,
      status: response.status,
      error: 'eBay returned empty item data.',
    };
  }

  return {
    item,
    status: response.status,
  };
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get('limit') ||
        DEFAULT_LIMIT
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

    const dryRun =
      request.nextUrl.searchParams.get('dryRun') === '1';

    const tokenResult = await getEbayToken();

    const accessToken = normalizeText(
      tokenResult.access_token
    );

    if (!accessToken) {
      throw new Error(
        'Unable to retrieve eBay access token.'
      );
    }

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
          source,
          source_type
        `
      )
      .not('ebay_item_id', 'is', null)
      .or(
        [
          'name.ilike.%reply as soon%',
          'description.ilike.%reply as soon%',
          'name.ilike.%not included in the item price%',
          'description.ilike.%not included in the item price%',
        ].join(',')
      )
      .order('id', { ascending: true })
      .limit(limit);

    if (productsError) {
      throw productsError;
    }

    const rows = (products ?? []) as ProductRow[];

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedManual = 0;
    let notFound = 0;
    let rateLimited = 0;
    let failed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of rows) {
      const ebayItemId = getLegacyItemId(
        product.ebay_item_id
      );

      try {
        if (isManualProduct(product)) {
          skippedManual++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'skipped_manual',
          });

          continue;
        }

        processed++;

        const ebayResponse = await fetchEbayItem(
          accessToken,
          ebayItemId
        );

        if (ebayResponse.status === 429) {
          rateLimited++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'rate_limited',
            error: ebayResponse.error,
          });

          break;
        }

        if (
          ebayResponse.status === 404 ||
          ebayResponse.status === 410
        ) {
          notFound++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'not_found',
            error: ebayResponse.error,
          });

          await wait(DELAY_MS);
          continue;
        }

        if (!ebayResponse.item) {
          failed++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'failed',
            error: ebayResponse.error,
          });

          await wait(DELAY_MS);
          continue;
        }

        const ebayTitle = cleanEbayTitle(
          ebayResponse.item.title
        );

        if (!ebayTitle || isCorruptedText(ebayTitle)) {
          failed++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'invalid_ebay_title',
          });

          await wait(DELAY_MS);
          continue;
        }

        const currentName = normalizeText(product.name);
        const currentDescription = normalizeText(
          product.description
        );

        const nameNeedsRepair =
          isCorruptedText(currentName);

        const descriptionNeedsRepair =
          isCorruptedText(currentDescription);

        const nextName = nameNeedsRepair
          ? ebayTitle
          : currentName;

        const safeTitleForDescription =
  !isCorruptedText(currentName) && currentName
    ? currentName
    : ebayTitle;

const nextDescription = descriptionNeedsRepair
  ? repairDescription(
      currentDescription,
      safeTitleForDescription
    )
  : currentDescription;

        if (
          !nameNeedsRepair &&
          !descriptionNeedsRepair
        ) {
          unchanged++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'unchanged',
          });

          await wait(DELAY_MS);
          continue;
        }

        if (dryRun) {
          results.push({
            id: product.id,
            ebayItemId,
            action: 'dry_run',
            beforeName: currentName,
            afterName: nextName,
            beforeDescription: currentDescription,
            afterDescription: nextDescription,
          });

          await wait(DELAY_MS);
          continue;
        }

        const updatePayload: {
          name?: string;
          description?: string;
          updated_at: string;
        } = {
          updated_at: new Date().toISOString(),
        };

        if (nameNeedsRepair) {
          updatePayload.name = nextName;
        }

        if (descriptionNeedsRepair) {
          updatePayload.description =
            nextDescription;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update(updatePayload)
            .eq('id', product.id);

        if (updateError) {
          throw updateError;
        }

        updated++;

        results.push({
          id: product.id,
          ebayItemId,
          action: 'updated',
          beforeName: currentName,
          afterName: nextName,
          beforeDescription: currentDescription,
          afterDescription: nextDescription,
        });

        await wait(DELAY_MS);
      } catch (error) {
        failed++;

        results.push({
          id: product.id,
          ebayItemId,
          action: 'failed',
          error: getErrorMessage(error),
        });

        await wait(DELAY_MS);
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: 'RESTORE-EBAY-DATA-V2-CLEAN',
      dryRun,
      summary: {
        loaded: rows.length,
        processed,
        updated,
        unchanged,
        skippedManual,
        notFound,
        rateLimited,
        failed,
      },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        routeVersion: 'RESTORE-EBAY-DATA-V2-CLEAN',
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
