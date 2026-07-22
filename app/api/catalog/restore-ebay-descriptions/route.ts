import { NextRequest, NextResponse } from 'next/server';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DELAY_MS = 900;

const ROUTE_VERSION =
  'RESTORE-EBAY-DESCRIPTIONS-V1-SAFE';

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  name: string | null;
  description: string | null;
  source: string | null;
  source_type: string | null;
};

type EbayItemResult = {
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

function isManualProduct(
  product: ProductRow
): boolean {
  const source = normalizeText(
    product.source
  ).toLowerCase();

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

function getObjectString(
  object: Record<string, unknown>,
  key: string
): string {
  return normalizeText(object[key]);
}

function decodeHtmlEntities(
  value: string
): string {
  return String(value || '')
    // Decode escaped HTML tags first.
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'")
    .replace(/\\"/g, '"')

    // Named HTML entities.
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ensp;/gi, ' ')
    .replace(/&emsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

    // Common numeric entities.
    .replace(/&#160;/gi, ' ')
    .replace(/&#34;/gi, '"')
    .replace(/&#38;/gi, '&')
    .replace(/&#60;/gi, '<')
    .replace(/&#62;/gi, '>');
}

function stripHtml(value: unknown): string {
  const decoded = decodeHtmlEntities(
    String(value ?? '')
  );

  return decoded
    // Remove scripts, CSS and hidden blocks.
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(
      /<!--[\s\S]*?-->/g,
      ' '
    )

    // Add separators around block elements.
    .replace(
      /<\s*br\s*\/?\s*>/gi,
      '\n'
    )
    .replace(
      /<\/\s*(p|div|li|tr|h1|h2|h3|h4|h5|h6)\s*>/gi,
      '\n'
    )
    .replace(
      /<\s*li\b[^>]*>/gi,
      '• '
    )

    // Remove remaining HTML tags.
    .replace(/<[^>]+>/g, ' ')

    // Clean escaped leftovers.
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\u00a0/g, ' ')

    // Normalize spacing.
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeCorruptedReplyText(
  value: string
): string {
  return value
    .replace(
      /we(?:'|’)?ll\s+reply\s+as\s+soon\s+as\s+possible[.!…]*/gi,
      ' '
    )
    .replace(
      /we\s+will\s+reply\s+as\s+soon\s+as\s+possible[.!…]*/gi,
      ' '
    )
    .replace(
      /they\s+are\s+not\s+included\s+in\s+the\s+item\s+price[.!…]*/gi,
      ' '
    )
    .replace(
      /not\s+included\s+in\s+the\s+item\s+price[.!…]*/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cutSellerPolicyText(
  value: string
): string {
  const policyHeadings = [
    'shipping',
    'shipping details',
    'shipping policy',
    'payment',
    'payment details',
    'payment policy',
    'feedback',
    'return policy',
    'returns',
    'warranty',
    'please note',
    'important note',
    'buyers are responsible',
    'buyer is responsible',
    'custom charges',
    'customs charges',
    'import duties',
    'handling time',
    'dispatch time',
    'express shipping',
    'expedited shipping',
    'contact us',
    'terms and conditions',
  ];

  const lowerText = value.toLowerCase();

  let cutPosition = value.length;

  for (const heading of policyHeadings) {
    const patterns = [
      `\n${heading}`,
      `\n\n${heading}`,
      `. ${heading}:`,
      ` ${heading}:`,
    ];

    for (const pattern of patterns) {
      const position =
        lowerText.indexOf(pattern);

      if (
        position >= 60 &&
        position < cutPosition
      ) {
        cutPosition = position;
      }
    }
  }

  return value
    .slice(0, cutPosition)
    .trim();
}

function removeSellerPolicySentences(
  value: string
): string {
  return value
    .replace(
      /buyers?\s+(?:are|is)\s+responsible\s+for\s+import\s+duties[\s\S]*$/gi,
      ''
    )
    .replace(
      /please\s+contact\s+us\s+before\s+leaving\s+feedback[\s\S]*$/gi,
      ''
    )
    .replace(
      /payment\s+to\s+be\s+done\s+using\s+paypal[\s\S]*$/gi,
      ''
    )
    .replace(
      /we\s+ship\s+after\s+receiving\s+payment[\s\S]*$/gi,
      ''
    )
    .replace(
      /expected\s+shipping\s+\(?\d+[\s-]*\d*\s+business\s+days?\)?[\s\S]*$/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDescription(
  value: unknown
): string {
  const plainText = stripHtml(value);

  const withoutReplies =
    removeCorruptedReplyText(plainText);

  const withoutPolicySection =
    cutSellerPolicyText(withoutReplies);

  return removeSellerPolicySentences(
    withoutPolicySection
  )
    .replace(/^[\s.,:;|/\\\-–—]+/g, '')
    .replace(/[\s|/\\\-–—]+$/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadDescription(
  value: unknown
): boolean {
  const text = String(value ?? '').toLowerCase();

  return (
    !normalizeText(value) ||
    text.includes('reply as soon') ||
    text.includes(
      'not included in the item price'
    ) ||
    text.includes('<div') ||
    text.includes('<span') ||
    text.includes('<font') ||
    text.includes('<p') ||
    text.includes('\\u003c') ||
    text.includes('&nbsp;') ||
    text.includes('msonormal') ||
    text.includes('font-family') ||
    text.includes('shipping policy') ||
    text.includes('payment policy')
  );
}

function buildFallbackDescription(
  productName: unknown
): string {
  const name = normalizeText(productName);

  if (!name) {
    return 'Product details available upon request.';
  }

  return name.endsWith('.')
    ? name
    : `${name}.`;
}

function chooseEbayDescription(
  item: Record<string, unknown>
): string {
  const candidates = [
    getObjectString(item, 'description'),
    getObjectString(item, 'shortDescription'),
  ];

  for (const candidate of candidates) {
    const cleaned =
      cleanDescription(candidate);

    if (
      cleaned.length >= 20 &&
      !isBadDescription(cleaned)
    ) {
      return cleaned;
    }
  }

  return '';
}

async function wait(
  milliseconds: number
): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<EbayItemResult> {
  const legacyItemId =
    getLegacyItemId(ebayItemId);

  if (!legacyItemId) {
    return {
      item: null,
      status: 400,
      error: 'Missing eBay item ID.',
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
      error:
        'eBay returned empty item data.',
    };
  }

  return {
    item,
    status: response.status,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get(
        'limit'
      ) || DEFAULT_LIMIT
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
      request.nextUrl.searchParams.get(
        'dryRun'
      ) === '1';

    const tokenResult =
      await getEbayToken();

    const accessToken =
      normalizeText(
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
          'description.ilike.%reply as soon%',
          'description.ilike.%not included in the item price%',
          'description.ilike.%<div%',
          'description.ilike.%<span%',
          'description.ilike.%<font%',
          'description.ilike.%<p%',
          'description.ilike.%\\\\u003c%',
          'description.ilike.%&nbsp;%',
          'description.ilike.%msonormal%',
          'description.ilike.%font-family%',
        ].join(',')
      )
      .order('id', {
        ascending: true,
      })
      .limit(limit);

    if (productsError) {
      throw productsError;
    }

    const rows =
      (products ?? []) as ProductRow[];

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedManual = 0;
    let notFound = 0;
    let rateLimited = 0;
    let fallbackUsed = 0;
    let failed = 0;

    const results: Array<
      Record<string, unknown>
    > = [];

    for (const product of rows) {
      const ebayItemId =
        getLegacyItemId(
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

        const ebayResponse =
          await fetchEbayItem(
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

        const beforeDescription =
          normalizeText(
            product.description
          );

        const ebayDescription =
          chooseEbayDescription(
            ebayResponse.item
          );

        const cleanedCurrentDescription =
          cleanDescription(
            product.description
          );

        let afterDescription =
          ebayDescription;

        let sourceUsed = 'ebay';

        if (!afterDescription) {
          if (
            cleanedCurrentDescription.length >= 20 &&
            !isBadDescription(
              cleanedCurrentDescription
            )
          ) {
            afterDescription =
              cleanedCurrentDescription;

            sourceUsed =
              'cleaned_current_description';
          } else {
            afterDescription =
              buildFallbackDescription(
                product.name
              );

            sourceUsed = 'product_name';
            fallbackUsed++;
          }
        }

        if (
          afterDescription ===
          beforeDescription
        ) {
          unchanged++;

          results.push({
            id: product.id,
            ebayItemId,
            action: 'unchanged',
            sourceUsed,
            beforeDescription,
            afterDescription,
          });

          await wait(DELAY_MS);
          continue;
        }

        if (dryRun) {
          results.push({
            id: product.id,
            ebayItemId,
            action: 'dry_run',
            sourceUsed,
            beforeDescription:
              beforeDescription.slice(
                0,
                500
              ),
            afterDescription:
              afterDescription.slice(
                0,
                1000
              ),
          });

          await wait(DELAY_MS);
          continue;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update({
              description:
                afterDescription,
              updated_at:
                new Date().toISOString(),
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
          sourceUsed,
          beforeDescription:
            beforeDescription.slice(
              0,
              300
            ),
          afterDescription:
            afterDescription.slice(
              0,
              700
            ),
        });

        await wait(DELAY_MS);
      } catch (error) {
        failed++;

        results.push({
          id: product.id,
          ebayItemId,
          action: 'failed',
          error:
            getErrorMessage(error),
        });

        await wait(DELAY_MS);
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion:
        ROUTE_VERSION,
      dryRun,

      safety: {
        updatesOnly: [
          'description',
          'updated_at',
        ],
        neverUpdates: [
          'name',
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
        fallbackUsed,
        failed,
      },

      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        routeVersion:
          ROUTE_VERSION,
        error:
          getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
