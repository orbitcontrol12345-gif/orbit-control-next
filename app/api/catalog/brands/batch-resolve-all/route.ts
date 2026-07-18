import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';

import {
  buildBrandDictionary,
} from '@/lib/brands/dictionary';

import {
  BRAND_UNKNOWN_RESOLVER_VERSION,
  resolveUnknownBrands,
} from '@/lib/brands/unknown-resolver';

import type {
  UnknownBrandProduct,
} from '@/lib/brands/unknown-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * يمكن رفعها إذا كان حساب Vercel يسمح بذلك.
 */
export const maxDuration = 60;

const ROUTE_VERSION =
  'BATCH-RESOLVE-ALL-BRANDS-V1';

const CONFIRMATION_TEXT =
  'RESOLVE-ALL';

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

const DEFAULT_MAX_PRODUCTS = 3000;
const MAX_PRODUCTS_PER_RUN = 5000;

const DEFAULT_CONCURRENCY = 10;
const MAX_CONCURRENCY = 20;

/*
 * نتوقف قبل انتهاء مهلة Vercel بقليل.
 */
const EXECUTION_TIME_LIMIT_MS = 50_000;

type RequestBody = {
  dryRun?: boolean;
  confirm?: string;

  /*
   * ابدأ بعد هذا Product ID.
   * أول تشغيل يكون 0.
   */
  afterId?: number;

  pageSize?: number;
  maxProducts?: number;
  concurrency?: number;
};

type ProductRow = Record<
  string,
  unknown
>;

type UpdateResult = {
  productId: string | number;
  previousBrand: string | null;
  suggestedBrand: string;
  confidence: string;
  score: number;

  status:
    | 'dry-run'
    | 'updated'
    | 'skipped'
    | 'failed';

  reason?: string;
  error?: string;
};

function isRecord(
  value: unknown
): value is ProductRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  value: unknown
): string | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const result =
      String(value).trim();

    return result || null;
  }

  return null;
}

function firstValue(
  row: ProductRow,
  keys: string[]
): string | null {
  for (const key of keys) {
    const result =
      stringValue(row[key]);

    if (result) {
      return result;
    }
  }

  return null;
}

function parseInteger(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      String(value),
      10
    );

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed =
    parseInteger(
      value,
      fallback
    );

  return Math.min(
    Math.max(
      parsed,
      minimum
    ),
    maximum
  );
}

function mapProduct(
  row: ProductRow
): UnknownBrandProduct | null {
  const rawId = row.id;

  if (
    typeof rawId !== 'string' &&
    typeof rawId !== 'number'
  ) {
    return null;
  }

  return {
    id: rawId,

    name:
      firstValue(row, [
        'name',
        'product_name',
      ]),

    title:
      firstValue(row, [
        'title',
        'name',
        'product_name',
      ]),

    partNumber:
      firstValue(row, [
        'part_number',
        'partNumber',
        'mpn',
        'model',
      ]),

    manufacturer:
      firstValue(row, [
        'manufacturer',
        'manufacturer_name',
      ]),

    existingBrand:
      firstValue(row, [
        'brand',
        'brand_name',
      ]),
  };
}

function isUnknownBrandValue(
  value: unknown
): boolean {
  if (
    value === null ||
    value === undefined
  ) {
    return true;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase();

  return (
    normalized === '' ||
    normalized === 'UNKNOWN'
  );
}

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  handler: (
    item: T
  ) => Promise<void>
): Promise<void> {
  for (
    let index = 0;
    index < items.length;
    index += chunkSize
  ) {
    const chunk =
      items.slice(
        index,
        index + chunkSize
      );

    await Promise.all(
      chunk.map(handler)
    );
  }
}

/*
 * GET يعرض التعليمات فقط.
 */
export async function GET() {
  return NextResponse.json({
    success: true,

    job:
      'batch-resolve-all-brands',

    routeVersion:
      ROUTE_VERSION,

    resolverVersion:
      BRAND_UNKNOWN_RESOLVER_VERSION,

    instructions: {
      method: 'POST',

      dryRunExample: {
        dryRun: true,
        afterId: 0,
        pageSize: 200,
        maxProducts: 3000,
        concurrency: 10,
      },

      applyExample: {
        dryRun: false,
        confirm:
          CONFIRMATION_TEXT,
        afterId: 0,
        pageSize: 200,
        maxProducts: 3000,
        concurrency: 10,
      },

      continuation:
        'If completed=false, run again using continuation.nextAfterId.',

      safetyRules: [
        'Only high-confidence auto-resolve results are updated.',
        'Review products are never updated.',
        'Unresolved products are never updated.',
        'Products that no longer have UNKNOWN brand are skipped.',
        `Real writes require confirm="${CONFIRMATION_TEXT}".`,
      ],
    },
  });
}

export async function POST(
  request: Request
) {
  const startedAt = new Date();
  const startedAtMs =
    startedAt.getTime();

  try {
    let body: RequestBody = {};

    try {
      const parsedBody =
        await request.json();

      if (isRecord(parsedBody)) {
        body =
          parsedBody as RequestBody;
      }
    } catch {
      /*
       * Empty body uses safe defaults.
       */
    }

    const dryRun =
      body.dryRun !== false;

    const confirmation =
      typeof body.confirm ===
      'string'
        ? body.confirm.trim()
        : '';

    if (
      !dryRun &&
      confirmation !==
        CONFIRMATION_TEXT
    ) {
      return NextResponse.json(
        {
          success: false,

          job:
            'batch-resolve-all-brands',

          routeVersion:
            ROUTE_VERSION,

          dryRun: false,
          writeEnabled: false,

          error:
            `Real update requires confirm="${CONFIRMATION_TEXT}".`,
        },
        {
          status: 400,
        }
      );
    }

    const pageSize =
      clampInteger(
        body.pageSize,
        DEFAULT_PAGE_SIZE,
        1,
        MAX_PAGE_SIZE
      );

    const maxProducts =
      clampInteger(
        body.maxProducts,
        DEFAULT_MAX_PRODUCTS,
        1,
        MAX_PRODUCTS_PER_RUN
      );

    const concurrency =
      clampInteger(
        body.concurrency,
        DEFAULT_CONCURRENCY,
        1,
        MAX_CONCURRENCY
      );

    const initialAfterId =
      Math.max(
        parseInteger(
          body.afterId,
          0
        ),
        0
      );

    let cursorId =
      initialAfterId;

    let lastScannedId =
      initialAfterId;

    let processedCount = 0;
    let eligibleCount = 0;
    let dryRunCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let reviewCount = 0;
    let unresolvedCount = 0;
    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let pagesProcessed = 0;

    let reachedEnd = false;
    let stoppedByTimeLimit = false;
    let stoppedByProductLimit = false;

    const resultSamples:
      UpdateResult[] = [];

    const failureResults:
      UpdateResult[] = [];

    const [brands, evidence] =
      await Promise.all([
        getActiveBrands(),
        getApprovedEvidence(),
      ]);

    const dictionary =
      buildBrandDictionary(
        brands,
        evidence
      );

    while (
      processedCount <
      maxProducts
    ) {
      const elapsedMs =
        Date.now() -
        startedAtMs;

      if (
        elapsedMs >=
        EXECUTION_TIME_LIMIT_MS
      ) {
        stoppedByTimeLimit =
          true;

        break;
      }

      const remainingCapacity =
        maxProducts -
        processedCount;

      const currentPageSize =
        Math.min(
          pageSize,
          remainingCapacity
        );

      /*
       * نستخدم id cursor وليس offset.
       * هذا يمنع تجاوز المنتجات أثناء
       * اختفاء المنتجات المحدثة من UNKNOWN.
       */
      const {
        data,
        error,
      } = await supabaseAdmin
        .from('products')
        .select('*')
        .or(
          [
            'brand.is.null',
            'brand.eq.UNKNOWN',
            'brand.eq.Unknown',
            'brand.eq.unknown',
          ].join(',')
        )
        .gt(
          'id',
          cursorId
        )
        .order('id', {
          ascending: true,
        })
        .limit(
          currentPageSize
        );

      if (error) {
        throw new Error(
          `Failed loading UNKNOWN products after ID ${cursorId}: ${error.message}`
        );
      }

      const rows =
        Array.isArray(data)
          ? data.filter(isRecord)
          : [];

      if (
        rows.length === 0
      ) {
        reachedEnd = true;
        break;
      }

      pagesProcessed += 1;

      const products =
        rows
          .map(mapProduct)
          .filter(
            (
              product
            ): product is UnknownBrandProduct =>
              product !== null
          );

      const sourceRowsById =
        new Map<
          string,
          ProductRow
        >(
          rows
            .filter(
              (row) =>
                row.id !== null &&
                row.id !== undefined
            )
            .map((row) => [
              String(row.id),
              row,
            ])
        );

      const resolutionBatch =
        resolveUnknownBrands(
          products,
          dictionary
        );

      processedCount +=
        resolutionBatch.results
          .length;

      reviewCount +=
        resolutionBatch.results
          .filter(
            (result) =>
              result.action ===
              'queue-review'
          ).length;

      unresolvedCount +=
        resolutionBatch.results
          .filter(
            (result) =>
              result.action ===
              'leave-unresolved'
          ).length;

      highConfidenceCount +=
        resolutionBatch.results
          .filter(
            (result) =>
              result.confidence ===
              'high'
          ).length;

      mediumConfidenceCount +=
        resolutionBatch.results
          .filter(
            (result) =>
              result.confidence ===
              'medium'
          ).length;

      const eligible =
        resolutionBatch.results
          .filter(
            (result) =>
              result.action ===
                'auto-resolve' &&
              result.confidence ===
                'high' &&
              result.suggestedBrand !==
                null
          );

      eligibleCount +=
        eligible.length;

      await runInChunks(
        eligible,
        concurrency,
        async (
          resolution
        ) => {
          const productId =
            resolution.productId;

          const suggestedBrand =
            resolution
              .suggestedBrand;

          if (!suggestedBrand) {
            skippedCount += 1;

            const result:
              UpdateResult = {
                productId,

                previousBrand:
                  null,

                suggestedBrand:
                  '',

                confidence:
                  resolution
                    .confidence,

                score:
                  resolution.score,

                status:
                  'skipped',

                reason:
                  'Suggested brand is empty.',
              };

            if (
              resultSamples.length <
              100
            ) {
              resultSamples.push(
                result
              );
            }

            return;
          }

          const sourceRow =
            sourceRowsById.get(
              String(productId)
            );

          const previousBrand =
            sourceRow
              ? firstValue(
                  sourceRow,
                  [
                    'brand',
                    'brand_name',
                  ]
                )
              : null;

          if (
            sourceRow &&
            !isUnknownBrandValue(
              sourceRow.brand
            )
          ) {
            skippedCount += 1;

            const result:
              UpdateResult = {
                productId,

                previousBrand,

                suggestedBrand,

                confidence:
                  resolution
                    .confidence,

                score:
                  resolution.score,

                status:
                  'skipped',

                reason:
                  'Product brand is no longer UNKNOWN.',
              };

            if (
              resultSamples.length <
              100
            ) {
              resultSamples.push(
                result
              );
            }

            return;
          }

          if (dryRun) {
            dryRunCount += 1;

            const result:
              UpdateResult = {
                productId,

                previousBrand,

                suggestedBrand,

                confidence:
                  resolution
                    .confidence,

                score:
                  resolution.score,

                status:
                  'dry-run',

                reason:
                  'Eligible for update.',
              };

            if (
              resultSamples.length <
              100
            ) {
              resultSamples.push(
                result
              );
            }

            return;
          }

          /*
           * التحديث مشروط بأن تبقى
           * العلامة UNKNOWN حتى لحظة الكتابة.
           */
          const {
            data: updatedProducts,
            error: updateError,
          } = await supabaseAdmin
            .from('products')
            .update({
              brand:
                suggestedBrand,
            })
            .eq(
              'id',
              productId
            )
            .or(
              [
                'brand.is.null',
                'brand.eq.UNKNOWN',
                'brand.eq.Unknown',
                'brand.eq.unknown',
              ].join(',')
            )
            .select(
              'id, brand'
            );

          if (updateError) {
            failedCount += 1;

            const result:
              UpdateResult = {
                productId,

                previousBrand,

                suggestedBrand,

                confidence:
                  resolution
                    .confidence,

                score:
                  resolution.score,

                status:
                  'failed',

                error:
                  updateError.message,
              };

            failureResults.push(
              result
            );

            if (
              resultSamples.length <
              100
            ) {
              resultSamples.push(
                result
              );
            }

            return;
          }

          if (
            !Array.isArray(
              updatedProducts
            ) ||
            updatedProducts.length ===
              0
          ) {
            skippedCount += 1;

            const result:
              UpdateResult = {
                productId,

                previousBrand,

                suggestedBrand,

                confidence:
                  resolution
                    .confidence,

                score:
                  resolution.score,

                status:
                  'skipped',

                reason:
                  'Product was already changed or no longer exists.',
              };

            if (
              resultSamples.length <
              100
            ) {
              resultSamples.push(
                result
              );
            }

            return;
          }

          updatedCount += 1;

          const result:
            UpdateResult = {
              productId,

              previousBrand,

              suggestedBrand,

              confidence:
                resolution
                  .confidence,

              score:
                resolution.score,

              status:
                'updated',
            };

          if (
            resultSamples.length <
            100
          ) {
            resultSamples.push(
              result
            );
          }
        }
      );

      const lastRow =
        rows[
          rows.length - 1
        ];

      const rawLastId =
        lastRow?.id;

      const parsedLastId =
        Number(
          rawLastId
        );

      if (
        !Number.isFinite(
          parsedLastId
        )
      ) {
        throw new Error(
          `Invalid product ID encountered: ${String(rawLastId)}`
        );
      }

      lastScannedId =
        parsedLastId;

      cursorId =
        parsedLastId;

      if (
        rows.length <
        currentPageSize
      ) {
        reachedEnd = true;
        break;
      }

      if (
        processedCount >=
        maxProducts
      ) {
        stoppedByProductLimit =
          true;

        break;
      }
    }

    const finishedAt =
      new Date();

    /*
     * completed=true يعني أننا وصلنا
     * إلى نهاية IDs في هذا المسح.
     */
    const completed =
      reachedEnd;

    const nextAfterId =
      completed
        ? null
        : lastScannedId;

    const {
      count: remainingUnknown,
      error: remainingCountError,
    } = await supabaseAdmin
      .from('products')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .or(
        [
          'brand.is.null',
          'brand.eq.UNKNOWN',
          'brand.eq.Unknown',
          'brand.eq.unknown',
        ].join(',')
      );

    return NextResponse.json({
      success:
        failedCount === 0,

      job:
        'batch-resolve-all-brands',

      routeVersion:
        ROUTE_VERSION,

      resolverVersion:
        BRAND_UNKNOWN_RESOLVER_VERSION,

      dryRun,

      writeEnabled:
        !dryRun,

      completed,

      stopReason:
        reachedEnd
          ? 'end-reached'
          : stoppedByTimeLimit
            ? 'time-limit'
            : stoppedByProductLimit
              ? 'product-limit'
              : 'unknown',

      continuation: {
        initialAfterId,

        lastScannedId,

        nextAfterId,

        message:
          completed
            ? 'Full ID scan completed.'
            : `Run again with afterId=${nextAfterId}.`,
      },

      settings: {
        pageSize,
        maxProducts,
        concurrency,
        executionTimeLimitMs:
          EXECUTION_TIME_LIMIT_MS,
      },

      dictionary: {
        totalBrands:
          dictionary.totalBrands,

        totalEvidence:
          dictionary.totalEvidence,

        generatedAt:
          dictionary.generatedAt,
      },

      summary: {
        pagesProcessed,

        processed:
          processedCount,

        eligible:
          eligibleCount,

        dryRunCount,

        updatedCount,

        skippedCount,

        failedCount,

        skippedReview:
          reviewCount,

        skippedUnresolved:
          unresolvedCount,

        highConfidenceCount,

        mediumConfidenceCount,

        attemptedWrites:
          dryRun
            ? 0
            : eligibleCount,

        actualWrites:
          updatedCount,

        remainingUnknown:
          remainingCountError
            ? null
            : remainingUnknown,
      },

      /*
       * نعيد أول 100 نتيجة فقط
       * حتى لا يصبح JSON ضخمًا.
       */
      resultSamples,

      failures:
        failureResults,

      timing: {
        startedAt:
          startedAt.toISOString(),

        finishedAt:
          finishedAt.toISOString(),

        durationMs:
          finishedAt.getTime() -
          startedAtMs,
      },
    });
  } catch (error) {
    console.error(
      'BATCH RESOLVE ALL ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'batch-resolve-all-brands',

        routeVersion:
          ROUTE_VERSION,

        resolverVersion:
          BRAND_UNKNOWN_RESOLVER_VERSION,

        writeEnabled: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
