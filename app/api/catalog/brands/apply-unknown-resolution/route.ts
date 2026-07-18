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

const ROUTE_VERSION =
  'APPLY-UNKNOWN-BRAND-RESOLUTION-V1';

const CONFIRMATION_TEXT = 'RESOLVE';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type RequestBody = {
  dryRun?: boolean;
  confirm?: string;
  limit?: number;
  offset?: number;
};

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
): value is Record<string, unknown> {
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
    const result = String(value).trim();

    return result || null;
  }

  return null;
}

function firstValue(
  row: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const result = stringValue(row[key]);

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

  const parsed = Number.parseInt(
    String(value),
    10
  );

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function mapProduct(
  row: Record<string, unknown>
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
  if (value === null || value === undefined) {
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

/*
 * GET لا يعدل أي شيء.
 * يعرض فقط طريقة استخدام الـ Route.
 */
export async function GET() {
  return NextResponse.json({
    success: true,

    job:
      'apply-unknown-brand-resolution',

    routeVersion:
      ROUTE_VERSION,

    resolverVersion:
      BRAND_UNKNOWN_RESOLVER_VERSION,

    writeEnabled: true,

    instructions: {
      method: 'POST',

      defaultMode:
        'dry-run',

      dryRunExample: {
        dryRun: true,
        limit: 100,
        offset: 0,
      },

      applyExample: {
        dryRun: false,
        confirm:
          CONFIRMATION_TEXT,
        limit: 100,
        offset: 0,
      },

      safetyRules: [
        'Only high-confidence auto-resolve results are eligible.',
        'Review and unresolved products are never updated.',
        'Products that no longer have an UNKNOWN brand are skipped.',
        `Real writes require confirm="${CONFIRMATION_TEXT}".`,
      ],
    },
  });
}

export async function POST(
  request: Request
) {
  const startedAt = new Date();

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
       * Empty or invalid JSON body:
       * continue using safe defaults.
       */
    }

    const dryRun =
      body.dryRun !== false;

    const confirmation =
      typeof body.confirm === 'string'
        ? body.confirm.trim()
        : '';

    const requestedLimit =
      parseInteger(
        body.limit,
        DEFAULT_LIMIT
      );

    const limit =
      Math.min(
        Math.max(
          requestedLimit,
          1
        ),
        MAX_LIMIT
      );

    const requestedOffset =
      parseInteger(
        body.offset,
        0
      );

    const offset =
      Math.max(
        requestedOffset,
        0
      );

    /*
     * لا نسمح بأي كتابة حقيقية دون
     * dryRun=false و confirm=RESOLVE.
     */
    if (
      !dryRun &&
      confirmation !==
        CONFIRMATION_TEXT
    ) {
      return NextResponse.json(
        {
          success: false,

          job:
            'apply-unknown-brand-resolution',

          routeVersion:
            ROUTE_VERSION,

          resolverVersion:
            BRAND_UNKNOWN_RESOLVER_VERSION,

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

    /*
     * نقرأ فقط المنتجات التي ما زالت
     * علامتها التجارية UNKNOWN أو null.
     */
    const {
      data,
      error,
      count,
    } = await supabaseAdmin
      .from('products')
      .select('*', {
        count: 'exact',
      })
      .or(
        [
          'brand.is.null',
          'brand.eq.UNKNOWN',
          'brand.eq.Unknown',
          'brand.eq.unknown',
        ].join(',')
      )
      .order('id', {
        ascending: true,
      })
      .range(
        offset,
        offset + limit - 1
      );

    if (error) {
      throw new Error(
        `Failed loading UNKNOWN products: ${error.message}`
      );
    }

    const rows =
      Array.isArray(data)
        ? data.filter(isRecord)
        : [];

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
        Record<string, unknown>
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

    /*
     * فقط هذه النتائج مسموح لها
     * أن تدخل مرحلة التحديث.
     */
    const eligible =
      resolutionBatch.results.filter(
        (result) =>
          result.action ===
            'auto-resolve' &&
          result.confidence ===
            'high' &&
          result.suggestedBrand !==
            null
      );

    const results: UpdateResult[] =
      [];

    for (
      const resolution of eligible
    ) {
      const productId =
        resolution.productId;

      const suggestedBrand =
        resolution.suggestedBrand;

      if (!suggestedBrand) {
        results.push({
          productId,

          previousBrand: null,

          suggestedBrand: '',

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'skipped',

          reason:
            'Suggested brand is empty.',
        });

        continue;
      }

      const sourceRow =
        sourceRowsById.get(
          String(productId)
        );

      const previousBrand =
        sourceRow
          ? firstValue(sourceRow, [
              'brand',
              'brand_name',
            ])
          : null;

      if (
        sourceRow &&
        !isUnknownBrandValue(
          sourceRow.brand
        )
      ) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'skipped',

          reason:
            'Product brand is no longer UNKNOWN.',
        });

        continue;
      }

      /*
       * Dry run:
       * نسجل ما كان سيحدث فقط.
       */
      if (dryRun) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'dry-run',

          reason:
            'Eligible for update.',
        });

        continue;
      }

      /*
       * فحص أخير قبل التحديث.
       * يمنع استبدال Brand تم تعديلها
       * بواسطة عملية أخرى أثناء التشغيل.
       */
      const {
        data: currentProduct,
        error: currentProductError,
      } = await supabaseAdmin
        .from('products')
        .select('id, brand')
        .eq('id', productId)
        .maybeSingle();

      if (currentProductError) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'failed',

          error:
            `Failed checking current product: ${currentProductError.message}`,
        });

        continue;
      }

      if (!currentProduct) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'skipped',

          reason:
            'Product no longer exists.',
        });

        continue;
      }

      if (
        !isUnknownBrandValue(
          currentProduct.brand
        )
      ) {
        results.push({
          productId,

          previousBrand:
            stringValue(
              currentProduct.brand
            ),

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'skipped',

          reason:
            'Brand changed before update.',
        });

        continue;
      }

      const {
        data: updatedProduct,
        error: updateError,
      } = await supabaseAdmin
        .from('products')
        .update({
          brand:
            suggestedBrand,
        })
        .eq('id', productId)
        .select('id, brand')
        .maybeSingle();

      if (updateError) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'failed',

          error:
            updateError.message,
        });

        continue;
      }

      if (!updatedProduct) {
        results.push({
          productId,

          previousBrand,

          suggestedBrand,

          confidence:
            resolution.confidence,

          score:
            resolution.score,

          status: 'failed',

          error:
            'Update returned no product.',
        });

        continue;
      }

      results.push({
        productId,

        previousBrand,

        suggestedBrand,

        confidence:
          resolution.confidence,

        score:
          resolution.score,

        status: 'updated',
      });
    }

    const dryRunCount =
      results.filter(
        (item) =>
          item.status ===
          'dry-run'
      ).length;

    const updatedCount =
      results.filter(
        (item) =>
          item.status ===
          'updated'
      ).length;

    const skippedCount =
      results.filter(
        (item) =>
          item.status ===
          'skipped'
      ).length;

    const failedCount =
      results.filter(
        (item) =>
          item.status ===
          'failed'
      ).length;

    const reviewCount =
      resolutionBatch.results.filter(
        (result) =>
          result.action ===
          'queue-review'
      ).length;

    const unresolvedCount =
      resolutionBatch.results.filter(
        (result) =>
          result.action ===
          'leave-unresolved'
      ).length;

    const finishedAt = new Date();

    return NextResponse.json({
      success:
        failedCount === 0,

      job:
        'apply-unknown-brand-resolution',

      routeVersion:
        ROUTE_VERSION,

      resolverVersion:
        BRAND_UNKNOWN_RESOLVER_VERSION,

      dryRun,

      writeEnabled:
        !dryRun,

      pagination: {
        offset,
        limit,

        loaded:
          products.length,

        totalUnknown:
          count ?? null,

        nextOffset:
          count !== null &&
          offset + products.length <
            count
            ? offset +
              products.length
            : null,
      },

      dictionary: {
        totalBrands:
          dictionary.totalBrands,

        totalEvidence:
          dictionary.totalEvidence,

        generatedAt:
          dictionary.generatedAt,
      },

      resolutionSummary:
        resolutionBatch.summary,

      summary: {
        processed:
          resolutionBatch.results
            .length,

        eligible:
          eligible.length,

        dryRunCount,

        updatedCount,

        skippedCount,

        failedCount,

        skippedReview:
          reviewCount,

        skippedUnresolved:
          unresolvedCount,

        attemptedWrites:
          dryRun
            ? 0
            : eligible.length,

        actualWrites:
          updatedCount,
      },

      results,

      timing: {
        startedAt:
          startedAt.toISOString(),

        finishedAt:
          finishedAt.toISOString(),

        durationMs:
          finishedAt.getTime() -
          startedAt.getTime(),
      },
    });
  } catch (error) {
    console.error(
      'APPLY UNKNOWN RESOLUTION ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'apply-unknown-brand-resolution',

        routeVersion:
          ROUTE_VERSION,

        resolverVersion:
          BRAND_UNKNOWN_RESOLVER_VERSION,

        dryRun: true,

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
