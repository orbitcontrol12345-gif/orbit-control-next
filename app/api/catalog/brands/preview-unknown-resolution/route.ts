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
  'PREVIEW-UNKNOWN-BRAND-RESOLUTION-V1';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

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

function parsePositiveInteger(
  value: string | null,
  fallback: number
): number {
  const parsed = Number.parseInt(
    value ?? '',
    10
  );

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
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

export async function GET(
  request: Request
) {
  const startedAt = new Date();

  try {
    const url = new URL(request.url);

    const requestedLimit =
      parsePositiveInteger(
        url.searchParams.get('limit'),
        DEFAULT_LIMIT
      );

    const limit = Math.min(
      requestedLimit,
      MAX_LIMIT
    );

    const requestedOffset =
      parsePositiveInteger(
        url.searchParams.get('offset'),
        0
      );

    const offset = Math.max(
      requestedOffset,
      0
    );

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
     * قراءة منتجات UNKNOWN فقط.
     *
     * هذا Route للمعاينة فقط:
     * لا يقوم بأي INSERT أو UPDATE.
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

    const resolutionBatch =
      resolveUnknownBrands(
        products,
        dictionary
      );

    const originalProducts =
      new Map(
        products.map((product) => [
          String(product.id),
          product,
        ])
      );

    const results =
      resolutionBatch.results.map(
        (resolution) => {
          const product =
            originalProducts.get(
              String(
                resolution.productId
              )
            );

          return {
            productId:
              resolution.productId,

            name:
              product?.name ??
              product?.title ??
              null,

            title:
              product?.title ??
              null,

            partNumber:
              product?.partNumber ??
              null,

            manufacturer:
              product?.manufacturer ??
              null,

            existingBrand:
              product?.existingBrand ??
              null,

            suggestedBrandId:
              resolution.suggestedBrandId,

            suggestedBrand:
              resolution.suggestedBrand,

            normalizedBrand:
              resolution.normalizedBrand,

            score:
              resolution.score,

            confidence:
              resolution.confidence,

            action:
              resolution.action,

            reasons:
              resolution.reasons,

            alternatives:
              resolution.alternatives.map(
                (candidate) => ({
                  brandId:
                    candidate.brandId,

                  brand:
                    candidate.brand,

                  score:
                    candidate.score,

                  evidenceCount:
                    candidate
                      .matchedEvidence
                      .length,
                })
              ),
          };
        }
      );

    const autoResolveResults =
      results.filter(
        (item) =>
          item.action ===
          'auto-resolve'
      );

    const reviewResults =
      results.filter(
        (item) =>
          item.action ===
          'queue-review'
      );

    const unresolvedResults =
      results.filter(
        (item) =>
          item.action ===
          'leave-unresolved'
      );

    const finishedAt = new Date();

    return NextResponse.json({
      success: true,

      job:
        'preview-unknown-brand-resolution',

      routeVersion:
        ROUTE_VERSION,

      resolverVersion:
        BRAND_UNKNOWN_RESOLVER_VERSION,

      readOnly: true,

      writeEnabled: false,

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
            ? offset + products.length
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

      summary: {
        ...resolutionBatch.summary,

        totalUnknownProducts:
          count ?? null,

        autoResolvePercentage:
          products.length > 0
            ? Number(
                (
                  (
                    autoResolveResults.length /
                    products.length
                  ) * 100
                ).toFixed(2)
              )
            : 0,

        reviewPercentage:
          products.length > 0
            ? Number(
                (
                  (
                    reviewResults.length /
                    products.length
                  ) * 100
                ).toFixed(2)
              )
            : 0,

        unresolvedPercentage:
          products.length > 0
            ? Number(
                (
                  (
                    unresolvedResults.length /
                    products.length
                  ) * 100
                ).toFixed(2)
              )
            : 0,
      },

      preview: {
        autoResolve:
          autoResolveResults,

        review:
          reviewResults,

        unresolved:
          unresolvedResults,
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
      'PREVIEW UNKNOWN RESOLUTION ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'preview-unknown-brand-resolution',

        routeVersion:
          ROUTE_VERSION,

        resolverVersion:
          BRAND_UNKNOWN_RESOLVER_VERSION,

        readOnly: true,

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
