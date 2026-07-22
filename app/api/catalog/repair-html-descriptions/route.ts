import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

const ROUTE_VERSION = 'REPAIR-HTML-DESCRIPTIONS-V1-CLEAN';

type ProductRow = {
  id: string | number;
  name: string | null;
  description: string | null;
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
 * يفك ترميز HTML والنصوص القادمة بصيغة:
 * \u003cdiv\u003e
 * &lt;div&gt;
 */
function decodeDescription(value: unknown): string {
  let text = String(value ?? '');

  // نكرر الفك مرتين لأن بعض الأوصاف تكون مشفرة مرتين.
  for (let index = 0; index < 2; index++) {
    text = text
      .replace(/\\u003c/gi, '<')
      .replace(/\\u003e/gi, '>')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u0022/gi, '"')
      .replace(/\\u0027/gi, "'")
      .replace(/\\u00a0/gi, ' ')
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\\"/g, '"')

      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&ensp;/gi, ' ')
      .replace(/&emsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&#160;/gi, ' ')
      .replace(/&#34;/gi, '"')
      .replace(/&#38;/gi, '&')
      .replace(/&#60;/gi, '<')
      .replace(/&#62;/gi, '>');
  }

  return text;
}

/**
 * يحول HTML إلى نص عادي.
 */
function stripHtml(value: unknown): string {
  return decodeDescription(value)
    // إزالة الأجزاء غير المرغوبة بالكامل.
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(/<!--[\s\S]*?-->/g, ' ')

    // تحويل فواصل HTML إلى أسطر ومسافات.
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(
      /<\/\s*(p|div|li|tr|table|h1|h2|h3|h4|h5|h6)\s*>/gi,
      '\n'
    )
    .replace(/<\s*li\b[^>]*>/gi, '• ')

    // إزالة جميع الوسوم المتبقية.
    .replace(/<[^>]+>/g, ' ')

    // إزالة أجزاء CSS التي قد تبقى كنص.
    .replace(
      /\b(?:font-family|font-size|line-height|background|text-align|vertical-align|mso-[a-z-]+)\s*:[^;]+;?/gi,
      ' '
    )

    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * يحذف رسائل الرد الخاطئة.
 */
function cleanDescription(value: unknown): string {
  const plainText = stripHtml(value);

  const withoutMessages =
    removeCorruptedMessages(plainText)
      .replace(
        /\s*Industrial equipment available for quotation(?:\s+and\s+worldwide\s+shipping)?\.?/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

  const withoutPolicies =
    cutSellerPolicy(withoutMessages);

  const withoutDuplicates =
    removeDuplicateHalves(withoutPolicies);

  return withoutDuplicates
    .replace(/^[\s.,:;|/\\\-–—]+/g, '')
    .replace(/[\s.,:;|/\\\-–—]+$/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يقطع وصف البائع عند بداية سياسة الشحن أو الدفع.
 *
 * نحافظ على الجزء الأول من الوصف، وهو غالبًا وصف المنتج.
 */
function cutSellerPolicy(value: string): string {
  const policyPatterns: RegExp[] = [
    /\bshipping\s+worldwide\b/i,
    /\bworldwide\s+shipping\b/i,
    /\bshipping\s+policy\b/i,
    /\bshipping\s+details\b/i,
    /\bexpress\s+shipping\b/i,
    /\bexpedited\s+shipping\b/i,
    /\bfed\s*ex\s+express\b/i,
    /\bdhl\s+express\b/i,
    /\bexpected\s+shipping\b/i,

    /\bpayment\s+policy\b/i,
    /\bpayment\s+details\b/i,
    /\bpayment\s+to\s+be\s+done\b/i,
    /\bpaypal\b/i,

    /\bfeedback\b/i,
    /\breturn\s+policy\b/i,
    /\breturns\b/i,
    /\bwarranty\b/i,

    /\bbuyers?\s+(?:are|is)\s+responsible\b/i,
    /\bimport\s+duties\b/i,
    /\bcustoms?\s+charges\b/i,
    /\bplease\s+note\b/i,
    /\bcontact\s+us\b/i,
    /\bterms\s+and\s+conditions\b/i,
  ];

  let cutPosition = value.length;

  for (const pattern of policyPatterns) {
    const match = pattern.exec(value);

    if (
      match?.index !== undefined &&
      match.index >= 15 &&
      match.index < cutPosition
    ) {
      cutPosition = match.index;
    }
  }

  return value
    .slice(0, cutPosition)
    .trim();
}

/**
 * يحذف تكرار النص المتطابق.
 *
 * بعض أوصاف eBay تحتوي وصف المنتج مرتين.
 */
function removeDuplicateHalves(value: string): string {
  const text = normalizeText(value);

  if (text.length < 80) {
    return text;
  }

  const midpoint = Math.floor(text.length / 2);

  const firstHalf = normalizeText(
    text.slice(0, midpoint)
  );

  const secondHalf = normalizeText(
    text.slice(midpoint)
  );

  if (
    firstHalf.length > 30 &&
    secondHalf.startsWith(
      firstHalf.slice(0, Math.min(80, firstHalf.length))
    )
  ) {
    return firstHalf;
  }

  return text;
}

function cleanDescription(value: unknown): string {
  const plainText = stripHtml(value);

  console.log('==========================');
  console.log('RAW DESCRIPTION');
  console.log(plainText);
  console.log('==========================');

  const withoutMessages =
    removeCorruptedMessages(plainText);

  const withoutPolicies =
    cutSellerPolicy(withoutMessages);

  const withoutDuplicates =
    removeDuplicateHalves(withoutPolicies);

  return withoutDuplicates
    .replace(
      /Industrial equipment available[\s\S]{0,80}?shipping\.?/gi,
      ''
    )
    .replace(/[|,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

function descriptionNeedsRepair(
  value: unknown
): boolean {
  const text = String(value ?? '').toLowerCase();

  return (
    !normalizeText(value) ||
    text.includes('reply as soon') ||
    text.includes('not included in the item price') ||
    text.includes('<div') ||
    text.includes('<span') ||
    text.includes('<font') ||
    text.includes('<p') ||
    text.includes('\\u003c') ||
    text.includes('&nbsp;') ||
    text.includes('msonormal') ||
    text.includes('font-family') ||
    text.includes('shipping worldwide') ||
    text.includes('worldwide shipping') ||
    text.includes('payment policy') ||
    text.includes('shipping policy')
  );
}

export async function GET(
  request: NextRequest
) {
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

    const {
      data: products,
      error: productsError,
    } = await supabaseAdmin
      .from('products')
      .select('id, name, description')
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
          'description.ilike.%shipping worldwide%',
          'description.ilike.%worldwide shipping%',
        ].join(',')
      )
      .order('id', { ascending: true })
      .limit(limit);

    if (productsError) {
      throw productsError;
    }

    const rows =
      (products ?? []) as ProductRow[];

    let scanned = 0;
    let updated = 0;
    let unchanged = 0;
    let fallbackUsed = 0;
    let failed = 0;

    const results: Array<
      Record<string, unknown>
    > = [];

    for (const product of rows) {
      scanned++;

      try {
        const beforeDescription =
          normalizeText(product.description);

        if (
          !descriptionNeedsRepair(
            product.description
          )
        ) {
          unchanged++;

          results.push({
            id: product.id,
            action: 'unchanged',
          });

          continue;
        }

        let afterDescription =
          cleanDescription(product.description);

        let sourceUsed =
          'cleaned_existing_description';

        /**
         * إذا أصبح النص فارغًا أو قصيرًا جدًا،
         * نستخدم اسم المنتج بدل حفظ وصف تالف.
         */
        if (afterDescription.length < 15) {
          afterDescription =
            buildFallbackDescription(
              product.name
            );

          sourceUsed = 'product_name';
          fallbackUsed++;
        }

        if (
          afterDescription ===
          beforeDescription
        ) {
          unchanged++;

          results.push({
            id: product.id,
            action: 'unchanged',
            sourceUsed,
            beforeDescription:
              beforeDescription.slice(0, 300),
            afterDescription:
              afterDescription.slice(0, 500),
          });

          continue;
        }

        if (dryRun) {
          results.push({
            id: product.id,
            action: 'dry_run',
            sourceUsed,
            beforeDescription:
              beforeDescription.slice(0, 500),
            afterDescription:
              afterDescription.slice(0, 1000),
          });

          continue;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update({
              description: afterDescription,
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
          action: 'updated',
          sourceUsed,
          beforeDescription:
            beforeDescription.slice(0, 300),
          afterDescription:
            afterDescription.slice(0, 700),
        });
      } catch (error) {
        failed++;

        results.push({
          id: product.id,
          action: 'failed',
          error: getErrorMessage(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
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
        scanned,
        updated,
        unchanged,
        fallbackUsed,
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
