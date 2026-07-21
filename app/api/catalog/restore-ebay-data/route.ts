import { NextRequest, NextResponse } from 'next/server';

import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CONCURRENCY = 5;

type ProductRow = {
  id: string;
  ebay_item_id: string | null;
  name: string | null;
  source: string | null;
  source_type: string | null;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * بعض قيم eBay تكون مثل:
 * v1|276643691235|0
 *
 * وبعضها تكون رقمًا مباشرًا:
 * 276643691235
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

/**
 * تنظيف آمن جدًا:
 * - يحافظ على رقم القطعة.
 * - يحافظ على الشرطات.
 * - لا يضيف البراند.
 * - لا يضيف Part Number.
 * - لا يعيد بناء الاسم بالتخمين.
 *
 * الهدف الآن هو استرجاع عنوان eBay الحقيقي.
 */
function cleanOriginalEbayTitle(value: unknown): string {
  return normalizeText(value)
    .replace(
      /\b(FREE SHIPPING|FAST SHIPPING|WORLDWIDE SHIPPING|SAME DAY SHIPPING|READY TO SHIP)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<{
  item: any | null;
  status: number;
  error?: string;
}> {
  const legacyItemId = getLegacyItemId(ebayItemId);

  if (!legacyItemId) {
    return {
      item: null,
      status: 400,
      error: 'Missing eBay Item ID.',
    };
  }

  const url =
    'https://api.ebay.com/buy/browse/v1/item/' +
    'get_item_by_legacy_id' +
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

  return {
    item,
    status: response.status,
  };
}

export async function GET(req: NextRequest) {
  try {
    /*
     * حماية اختيارية عند تشغيل المسار من Cron.
     * إذا لم يوجد CRON_SECRET فلن يمنع التشغيل اليدوي.
     */
    const cronSecret = normalizeText(
      process.env.CRON_SECRET
    );

    const authorization = normalizeText(
      req.headers.get('authorization')
    );

    const secretFromQuery = normalizeText(
      req.nextUrl.searchParams.get('secret')
    );

    if (
      cronSecret &&
      authorization !== `Bearer ${cronSecret}` &&
      secretFromQuery !== cronSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized.',
        },
        {
          status: 401,
        }
      );
    }

    const requestedOffset = Number(
      req.nextUrl.searchParams.get('offset') || 0
    );

    const requestedLimit = Number(
      req.nextUrl.searchParams.get('limit') ||
        DEFAULT_LIMIT
    );

    const dryRun =
      req.nextUrl.searchParams.get('dryRun') === '1';

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

    const { access_token } =
      await getEbayToken();

    const accessToken =
      normalizeText(access_token);

    if (!accessToken) {
      throw new Error(
        'Unable to retrieve an eBay access token.'
      );
    }

    /*
     * نقرأ فقط المنتجات المرتبطة بـ eBay.
     *
     * لا نقرأ الصور أو Part Number أو البراند،
     * لأن هذا المسار لن يلمسها نهائيًا.
     */
    const {
      data: products,
      error: productsError,
    } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        name,
        source,
        source_type
      `)
      .not('ebay_item_id', 'is', null)
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
      (products || []) as ProductRow[];

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedManual = 0;
    let missingTitle = 0;
    let notFound = 0;
    let rateLimited = 0;
    let failed = 0;

    const results: Array<{
      id: string;
      ebayItemId: string;
      before?: string;
      after?: string;
      action: string;
      error?: string;
    }> = [];

    for (
      let index = 0;
      index < rows.length;
      index += CONCURRENCY
    ) {
      const chunk = rows.slice(
        index,
        index + CONCURRENCY
      );

      const fetchedItems =
        await Promise.all(
          chunk.map(async (product) => {
            if (isManualProduct(product)) {
              return {
                product,
                response: null,
                manual: true,
              };
            }

            const ebayItemId =
              getLegacyItemId(
                product.ebay_item_id
              );

            const response =
              await fetchEbayItem(
                accessToken,
                ebayItemId
              );

            return {
              product,
              response,
              manual: false,
            };
          })
        );

      for (const entry of fetchedItems) {
        const { product } = entry;

        const ebayItemId =
          getLegacyItemId(
            product.ebay_item_id
          );

        try {
          if (entry.manual) {
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

          processed++;

          const response = entry.response;

          if (!response) {
            failed++;

            continue;
          }

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

            continue;
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

            continue;
          }

          const originalEbayTitle =
            cleanOriginalEbayTitle(
              response.item.title
            );

          if (!originalEbayTitle) {
            missingTitle++;

            if (results.length < 50) {
              results.push({
                id: product.id,
                ebayItemId,
                action: 'missing_title',
              });
            }

            continue;
          }

          const currentName =
            normalizeText(product.name);

          if (
            currentName === originalEbayTitle
          ) {
            unchanged++;

            if (results.length < 50) {
              results.push({
                id: product.id,
                ebayItemId,
                before: currentName,
                after: originalEbayTitle,
                action: 'unchanged',
              });
            }

            continue;
          }

          /*
           * في وضع dryRun نعرض النتيجة فقط
           * ولا نحدث قاعدة البيانات.
           */
          if (dryRun) {
            if (results.length < 50) {
              results.push({
                id: product.id,
                ebayItemId,
                before: currentName,
                after: originalEbayTitle,
                action: 'dry_run',
              });
            }

            continue;
          }

          /*
           * تحديث الاسم فقط.
           *
           * لا نلمس:
           * - part_number
           * - model_number
           * - brand
           * - category
           * - description
           * - condition
           * - slug
           * - SKU
           * - صور eBay
           * - صور R2
           */
          const { error: updateError } =
            await supabaseAdmin
              .from('products')
              .update({
                name: originalEbayTitle,
                updated_at:
                  new Date().toISOString(),
              })
              .eq('id', product.id);

          if (updateError) {
            throw updateError;
          }

          updated++;

          if (results.length < 50) {
            results.push({
              id: product.id,
              ebayItemId,
              before: currentName,
              after: originalEbayTitle,
              action: 'updated',
            });
          }
        } catch (error) {
          failed++;

          const message =
            getErrorMessage(error);

          console.error(
            `RESTORE EBAY TITLE FAILED FOR ${product.id}:`,
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
        }
      }

      /*
       * عند وصولنا إلى Rate Limit نتوقف،
       * حتى لا نهدر بقية الطلبات.
       */
      if (rateLimited > 0) {
        break;
      }
    }

    const reachedEnd =
      rows.length < limit;

    const nextOffset = reachedEnd
      ? 0
      : offset + rows.length;

    const baseUrl =
      req.nextUrl.origin +
      req.nextUrl.pathname;

    const nextUrl = reachedEnd
      ? null
      : `${baseUrl}?offset=${nextOffset}&limit=${limit}`;

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? 'Preview completed. No database records were changed.'
        : 'Original eBay product titles were restored. Only the name field was updated.',

      batch: {
        offset,
        limit,
        rowsLoaded: rows.length,
        nextOffset,
        reachedEnd,
        nextUrl,
      },

      summary: {
        processed,
        updated,
        unchanged,
        skippedManual,
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
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
