import { NextRequest, NextResponse } from 'next/server';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const DELAY_MS = 900;

const ROUTE_VERSION = 'RESTORE-EBAY-TITLES-V3-CLEAN';

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  name: string | null;
  source: string | null;
  source_type: string | null;
};

type EbayResponse = {
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
  const text = normalizeText(value);

  if (!text) {
    return '';
  }

  if (text.includes('|')) {
    const parts = text.split('|');

    return normalizeText(parts[1] || parts[0]);
  }

  return text;
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

function containsCorruptedText(value: unknown): boolean {
  const text = normalizeText(value).toLowerCase();

  return (
    !text ||
    text.includes('reply as soon as possible') ||
    text.includes('not included in the item price')
  );
}

function cleanProductTitle(value: unknown): string {
  return normalizeText(value)
    // Remove quantity / lot text from the beginning.
    .replace(
      /^\s*LOTS?\s*(?:OF\s*)?\d+\s*(?:PCS?|PIECES?|UNITS?|ITEMS?)?[\s:,.–—-]*/i,
      ''
    )
    .replace(
      /^\s*\d+\s*(?:PCS?|PIECES?|UNITS?|ITEMS?)[\s:,.–—-]*/i,
      ''
    )
    .replace(
      /^\s*(?:QTY|QUANTITY)\s*[:#-]?\s*\d+[\s:,.–—-]*/i,
      ''
    )
    .replace(/^\s*\d+\s*[X×]\s*/i, '')

    // Remove condition text.
    .replace(/\bNEW\s+OPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+WITHOUT\s+BOX\b/gi, '')
    .replace(/\bNEW\s+WITH\s+BOX\b/gi, '')
    .replace(/\bOPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OLD\s+STOCK\b/gi, '')
    .replace(/\bNEW\s+SEALED\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bTESTED\s+OK\b/gi, '')
    .replace(/\bTRIED\s*(?:&|AND)\s*TESTED\b/gi, '')
    .replace(/\bUSED\b/gi, '')

    // Remove complete packaging / damaged-item phrases.
    .replace(
      /\bNEW\s+WITH\s+MISSING\s+COVER\s*&\s*WITHOUT\s+BOX\b/gi,
      ''
    )
    .replace(
      /\bWITH\s+MISSING\s+COVER\s*&\s*WITHOUT\s+BOX\b/gi,
      ''
    )
    .replace(
      /\b(?:NEW\s+)?WITH\s+(?:MISSING|BROKEN|DAMAGED)\s+(?:COVER|BOX|PARTS?)\b/gi,
      ''
    )
    .replace(/\bWITHOUT\s+ANY\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+ACCESSORIES\b/gi, '')
    .replace(/\bNO\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+BOX\b/gi, '')
    .replace(/\bNO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bNO\s+BOX\b/gi, '')
    .replace(/\bW\/O\s+BOX\b/gi, '')
    .replace(/\bMISSING\s+COVER\b/gi, '')
    .replace(/\bBROKEN\s+COVER\b/gi, '')
    .replace(/\bDAMAGED\s+BOX\b/gi, '')
    .replace(/\bBROKEN\s+BOX\b/gi, '')

    // Remove shipping text.
    .replace(/\bFREE\s+SHIPPING\b/gi, '')
    .replace(/\bFAST\s+SHIPPING\b/gi, '')
    .replace(/\bWORLDWIDE\s+SHIPPING\b/gi, '')

    // Remove leftover standalone NEW.
    .replace(/\bNEW\b/gi, '')

    // Final cleanup.
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s*&\s*$/g, '')
    .replace(/\s*[-–—]+\s*$/g, '')
    .replace(/^[\s.,:;|/\\\-–—]+/g, '')
    .replace(/[\s.,:;|/\\\-–—]+$/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return String(html || '')
    // Remove script/style
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

    // Convert common breaks to spaces
    .replace(/<\/?(div|p|br|li|tr|td|font|span|b|strong|i|u)[^>]*>/gi, ' ')

    // Remove any remaining HTML
    .replace(/<[^>]+>/g, ' ')

    // Decode common entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

    // Remove unicode escaped tags left from JSON
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026nbsp;/gi, ' ')
    .replace(/\\u0026quot;/gi, '"')

    // Final cleanup
    .replace(/\s+/g, ' ')
    .trim();
}
async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<EbayResponse> {
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
    const errorText = await response
      .text()
      .catch(() => '');

    return {
      item: null,
      status: response.status,
      error:
        errorText ||
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
          source,
          source_type
        `
      )
      .not('ebay_item_id', 'is', null)
      .or(
        [
          'name.ilike.%reply as soon%',
          'name.ilike.%not included in the item price%',
          'name.ilike.%without box%',
          'name.ilike.%no box%',
          'name.ilike.%missing cover%',
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

        const ebayTitle = cleanProductTitle(
          ebayResponse.item.title
        );

        if (
          !ebayTitle ||
          containsCorruptedText(ebayTitle)
        ) {
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

        const cleanedCurrentName =
          cleanProductTitle(currentName);

        const currentNameIsCorrupted =
          containsCorruptedText(currentName);

        const nextName = currentNameIsCorrupted
          ? ebayTitle
          : cleanedCurrentName || ebayTitle;

        if (nextName === currentName) {
          unchanged++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'unchanged',
            beforeName: currentName,
            afterName: nextName,
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
          });

          await wait(DELAY_MS);
          continue;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update({
              name: nextName,
              updated_at: new Date().toISOString(),
            })
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
      routeVersion: ROUTE_VERSION,
      dryRun,
      safety: {
        updatesOnly: ['name', 'updated_at'],
        neverUpdates: [
          'description',
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
        routeVersion: ROUTE_VERSION,
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
